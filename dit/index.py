import bleach, git, json, markdown, os, re, uuid

bleach.ALLOWED_TAGS.append('p')

class Index(object):

  def __init__(self):
    self.root = find_root(os.getcwd())
    self._issues_by_id = {uuid.UUID(issue['id']):issue for issue in self._load_issues()}
    self._comments_by_id = {uuid.UUID(comment['id']):comment for issue in self._issues_by_id.values() for comment in issue['_comments']}
    self.index_history()
  
  def index_history(self):
    def index(commit, diff, blob):
      if blob is None: return
      if not blob.path.endswith('.json'): return
      o = json.load(blob.data_stream)
      uid = uuid.UUID(o['id'])
      author = str(commit.author)
      authors_list = self._issues_by_id[uid]['_authors'] if uid in self._issues_by_id else None
      print uid, author
      if uid in self._comments_by_id:
        authors_list = self._comments_by_id[uid]['_authors']
      if authors_list is not None and author not in authors_list:
        authors_list.append(author)
    project_dir = os.path.dirname(self.root)
    repo = git.Repo(project_dir)
    for commit in repo.iter_commits():
      for diff in commit.diff():
        index(commit, diff, diff.a_blob)
        index(commit, diff, diff.b_blob)
    
  
  def repo(self):
    project_dir = os.path.dirname(self.root)
    repo = git.Repo(project_dir)
    return {
      'project_dir': project_dir,
      'project': os.path.split(project_dir)[-1],
      'origin': repo.remotes.origin.url if len(repo.remotes) else '(no origin)',
      '__dit_version__': '0.1',
      'branch': repo.head.reference.name,
    }
    
  def issues(self):
    return self._issues_by_id.values()
    
  def _load_issues(self):
    issues_dir = os.path.join(self.root,'issues')
    for fn in os.listdir(issues_dir):
      issue_path = os.path.join(issues_dir,fn)
      if os.path.isdir(issue_path):
        with open(os.path.join(issue_path,'issue.json'),'r') as f:
          issue = json.load(f)
          issue['_comments'] = []
          issue['_authors'] = []
          issue['__path'] = issue_path
          for cfn in os.listdir(os.path.join(issue_path,'comments')):
            cfn = os.path.join(issue_path,'comments',cfn)
            with open(cfn,'r') as cf:
              comment = json.load(cf)
              comment['_authors'] = []
              comment['_text'] = bleach.clean(markdown.markdown(comment['text']))
              issue['_comments'].append(comment)
          yield issue
  
  def issue(self, uid):
    return self._issues_by_id[uid]
  
  def _issue_path(self, uid):
    uid = uuid.UUID(uid)
    return self._issues_by_id[uid]['__path']
  
  def save_issue(self, issue):
    uid = uuid.UUID(issue['id'])
    fn = os.path.join(self._issue_path(issue['id']),'issue.json')
    issue = save(issue, fn)
    self._issues_by_id[uid].update(issue)
  
  def _get_comment_path(self, comment):
    comment_path = os.path.join(self._issue_path(comment['issue_id']),'comments')
    if not os.path.isdir(comment_path):
      os.mkdir(comment_path)
    for fn in os.listdir(comment_path):
      fn = os.path.join(comment_path,fn)
      with open(fn,'r') as f:
        c = json.load(f)
        if c['id'] == comment['id']:
          return fn
    return os.path.join(comment_path, '%s-%s' % (slugify(comment['text']), comment['id']))

  def save_comment(self, comment):
    print comment
    if 'id' in comment: comment['id'] = str(uuid.UUID(comment['id']))
    else: comment['id'] = str(uuid.uuid4())
    comment['issue_id'] = str(uuid.UUID(comment['issue_id']))
    fn = self._get_comment_path(comment)
    save(comment, fn)
    comment['_text'] = bleach.clean(markdown.markdown(comment['text']))
    return comment


def save(o, fn):
  o = o.copy()
  with open(fn,'w') as f:
    for k in o.keys():
      if k.startswith('_'):
        del o[k]
    print 'writing', fn
    json.dump(o,f, sort_keys=True, indent=4)
  return o

def find_root(path):
  candidate = os.path.join(path,'.dit')
  if os.path.isdir(candidate):
    return candidate
  if path=='/': return None
  return os.path.dirname(path)
    
    
def slugify(s):
  return '-'.join(re.split(r'\W+', s))

