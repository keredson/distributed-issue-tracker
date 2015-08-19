import base64, datetime, json, re, urllib2, uuid
import dateutil.parser

import index


class GitHub(object):
  def __init__(self, owner, repo, username=None, password=None, idx=None):
    self.owner = owner
    self.repo = repo
    self.username = username
    self.password = password
    self.idx = idx if idx else index.Index()
    
  def run(self):
    issues = []
    issues.extend(self._download_issues())
    issues.extend(self._download_issues(state='closed'))
    print 'len(issues)', len(issues)
    self._import_issues(issues)
  
  def _download_issues(self, state=None):
    issues = []
    p = 1
    while p<=1: #True:
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
    for gh_issue in gh_issues:
      issue = self._get_or_import_issue(gh_issue)
      if not issue: continue
      comments = self._download_comments(issue, gh_issue['comments_url'])
      for comment in comments:
        self._get_or_import_comment(issue, comment)
      events = self._download_comments(issue, gh_issue['events_url'])
      for event in events:
        self._get_or_import_comment(issue, event)
#      return

  def _get_or_import_comment(self, issue, data):
    self._deunicode(data)
    author = self._get_or_import_user(data.get('user') or data.get('actor'))
    uid = '%sCommentGH' % data['id']
    comment = self.idx[uid]
    if comment: return comment
    #print json.dumps(data, indent=2)
    comment = issue.new_comment()
    comment.id = uid
    if 'body' in data:
      comment.text = self._fix_html_images(data['body'])
    if data.get('event')=='assigned':
      comment.kind = 'assigned'
      comment.assignee = self._get_or_import_user(data.get('assignee')).id
    if data.get('event')=='unassigned':
      comment.kind = 'unassigned'
      comment.assignee = self._get_or_import_user(data.get('assignee')).id
    if data.get('event')=='labeled':
      comment.kind = 'labeled'
      comment.label = self._get_or_import_label(data.get('label')).id
    if data.get('event')=='unlabeled':
      comment.kind = 'unlabeled'
      comment.label = self._get_or_import_label(data.get('label')).id
    if data.get('event')=='closed':
      comment.kind = 'resolved'
    if data.get('event')=='reopened':
      comment.kind = 'reopened'
    comment.created_at = dateutil.parser.parse(data['created_at'])
    comment.updated_at = dateutil.parser.parse(data['updated_at']) if 'updated_at' in data else comment.created_at
    comment.author = author.id
    comment.save()
      
  def _get_or_import_issue(self, data):
    if 'pull_request' in data:
      print 'skipping pull request', data['number']
      return None
    self._deunicode(data)
    author = self._get_or_import_user(data['user'])
    assignee = self._get_or_import_user(data['assignee'])
    uid = str(data['number'])
    #if data['number']==3508: print json.dumps(data, indent=2)
    issue = self.idx[uid]
    if issue: return issue
    issue = self.idx.new_issue()
    issue.id = uid
    issue.title = data['title']
    issue.created_at = dateutil.parser.parse(data['created_at'])
    issue.updated_at = dateutil.parser.parse(data['updated_at'])
    issue.author = author.id
    issue.save()
    comment = issue.new_comment()
    comment.text = self._fix_html_images(data['body'])
    comment.created_at = issue.created_at
    comment.author = author.id
    comment.save()
    return issue

  def _fix_html_images(self, text):
    def f(m):
      return '![%s](%s)' % (m.group(1), m.group(1))
    return re.sub(r'''<img[^>]*? src=['"]([^'"]*)['"].*?>''', f, text, re.S | re.I | re.M)

  def _get_or_import_user(self, gh_user):
    if not gh_user: return None
    self._deunicode(gh_user)
    uid = '%s%sGH' % (gh_user['id'], gh_user['type'])
    user = self.idx[uid]
    if user: return user
    user = index.User(self.idx)
    user.id = uid
    user.name = gh_user['login']
    user.avatar_url = gh_user['avatar_url']
    user.url = gh_user['url']
    user.aka.append(gh_user['login'])
    user.save()
    return user

  def _get_or_import_label(self, data):
    self._deunicode(data)
    uid = '%sLabelGH' % abs(data['name'].__hash__())
    label = self.idx[uid]
    if label: return label
    label = self.idx.new_label()
    label.id = uid
    label.name = data['name']
    color = data['color']
    components = [int(color[:2],16), int(color[2:4],16), int(color[4:],16)]
    label.fg_color = '#ffffff' if sum(components)/3 < 150 else '#000000'
    label.bg_color = '#%s' % color
    label.save()
    return label

  def _deunicode(self, o):
    for k,v in o.items():
      if isinstance(v, unicode):
        try:
          o[k] = v.encode('ascii')
        except:
          pass

  def _download_comments(self, issue, comments_url):
    comments = []
    p = 1
    while True:
      url = comments_url + '?page=%i' % p
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


