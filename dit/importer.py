import base64, datetime, json, urllib2, uuid
import dateutil.parser

import index

class GitHub(object):
  def __init__(self, owner, repo, username=None, password=None, idx=None):
    self.owner = owner
    self.repo = repo
    self.username = username
    self.password = password
    self.index = idx if idx else index.Index()
    
  def run(self):
    issues = []
    issues.extend(self._download_issues())
    issues.extend(self._download_issues(state='closed'))
    print 'len(issues)', len(issues)
    self._import_issues(issues)
  
  def _download_issues(self, state=None):
    issues = []
    p = 1
    while True:
      url = 'https://api.github.com/repos/%s/%s/issues?page=%i%s' % (self.owner, self.repo, p, '&state='+state if state else '')
      print url
      base64string = base64.encodestring(str(self.username) +":"+ str(self.password)).replace('\n', '')
      request = urllib2.Request(url)
      request.add_header("Authorization", "Basic %s" % base64string)
      request.add_header('User-agent', 'Distributed Issue Tracker (Import Tool)')
      f = urllib2.urlopen(request)
      page = json.load(f)
      if len(page)==0: break
      issues.extend(page)
      p += 1
    return issues

  def _import_issues(self, gh_issues):
    github_id_to_issue_id = {}
    for issue in self.index.issues():
      gh_issue = issue.get('original_github')
      if not gh_issue: continue
      github_id_to_issue_id[gh_issue['id']] = uuid.UUID(issue['id'])
      
    for gh_issue in gh_issues:
      if gh_issue['id'] in github_id_to_issue_id:
        issue = self.index.issue(github_id_to_issue_id[gh_issue['id']])
      else:
        issue = {}
      issue['original_github'] = gh_issue
      issue = self._interpret_original_issue(issue)
      self.index.save_issue(issue)
      comments = self._download_comments(issue)
      self._import_comments(issue, comments)
  
  def _download_comments(self, issue):
    comments = []
    p = 1
    while True:
      url = issue['original_github']['comments_url'] + '?page=%i' % p
      print url
      base64string = base64.encodestring(str(self.username) +":"+ str(self.password)).replace('\n', '')
      request = urllib2.Request(url)
      request.add_header("Authorization", "Basic %s" % base64string)
      request.add_header('User-agent', 'Distributed Issue Tracker (Import Tool)')
      f = urllib2.urlopen(request)
      page = json.load(f)
      if len(page)==0: break
      comments.extend(page)
      p += 1
    return comments

  def _import_comments(self, issue, gh_comments):
    github_id_to_comment_id = {}
    for comment in self.index.issue(uuid.UUID(issue['id']))['_comments']:
      gh_comment = comment.get('original_github')
      if not gh_comment: continue
      github_id_to_comment_id[gh_comment['id']] = uuid.UUID(comment['id'])
      
    for gh_comment in gh_comments:
      if gh_comment['id'] in github_id_to_comment_id:
        comment = self._objects_by_id[github_id_to_comment_id[gh_comment['id']]]
      else:
        comment = {'issue_id': issue['id']}
      comment['original_github'] = gh_comment
      comment = self._interpret_original_comment(comment)
      self.index.save_comment(comment)

  def _interpret_original_issue(self, issue):
    issue = issue.copy()
    gh_issue = issue['original_github']
    issue['title'] = gh_issue['title']
    issue['state'] = gh_issue['state']
    created_at = dateutil.parser.parse(gh_issue['created_at'])
    epoch = datetime.datetime.utcfromtimestamp(0).replace(tzinfo=created_at.tzinfo)
    issue['created_on'] = int((created_at-epoch).total_seconds())
    return issue

  def _interpret_original_comment(self, comment):
    comment = comment.copy()
    gh_comment = comment['original_github']
    comment['text'] = gh_comment['body']
    created_at = dateutil.parser.parse(gh_comment['created_at'])
    epoch = datetime.datetime.utcfromtimestamp(0).replace(tzinfo=created_at.tzinfo)
    comment['created_on'] = int((created_at-epoch).total_seconds())
    return comment

  def reinterpret(self):
    for issue in self.index.issues():
      if 'original_github' not in issue: continue
      new_issue = self._interpret_original_issue(issue)
      if True or new_issue != issue:
        self.index.save_issue(new_issue)
      for comment in self.index.issue(uuid.UUID(issue['id']))['_comments']:
        if 'original_github' not in comment: continue
        new_comment = self._interpret_original_comment(comment)
        if True or new_comment != comment:
          self.index.save_comment(new_comment)



