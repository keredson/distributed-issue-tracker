import bleach, collections, git, json, markdown, os, re, traceback, uuid

bleach.ALLOWED_TAGS.append('p')

class Index(object):

  def __init__(self):
    self.root = find_root(os.getcwd())
    self._comments_by_id = {}
    self._comment_ids_by_issue_id = collections.defaultdict(set)
    self._issues_by_id = {uuid.UUID(issue['id']):issue for issue in self._load_issues()}
    self.index_history()
  
  def index_history(self):
    def index(commit, diff, blob):
      if blob is None: return
      if not blob.path.startswith('.dit/'): return
      if not blob.path.endswith('.json'): return
      uid = None
      try:
        o = json.load(blob.data_stream)
        uid = uuid.UUID(o['id'])
      except Exception as e:
        traceback.print_exc()
        print 'could not decode', blob.path
      author = str(commit.author)
      original = None
      if uid in self._issues_by_id: original = self._issues_by_id[uid]
      if uid in self._comments_by_id: original = self._comments_by_id[uid]
      print uid, author
      if original is not None:
        if author not in original['_authors']:
          original['_authors'].append(author)
        original['_committed_on'] = commit.committed_date
    project_dir = os.path.dirname(self.root)
    repo = git.Repo(project_dir)
    for commit in repo.iter_commits():
      for diff in commit.diff():
        index(commit, diff, diff.a_blob)
        index(commit, diff, diff.b_blob)
    
  
  def repo(self):
    project_dir = os.path.dirname(self.root)
    repo = git.Repo(project_dir)
    print 'repo.is_dirty()', repo.is_dirty()
    return {
      'project_dir': project_dir,
      'project': os.path.split(project_dir)[-1],
      'origin': repo.remotes.origin.url if len(repo.remotes) else '(no origin)',
      'dit_version': '0.1',
      'branch': repo.head.reference.name,
      'is_dirty': repo.is_dirty(),
    }
    
  def issues(self):
    issues = self._issues_by_id.values()
    for issue in issues:
      issue['_comments'] = ['' for cid in self._comment_ids_by_issue_id[uuid.UUID(issue['id'])]]
    return issues
    
  def _load_issues(self):
    issues_dir = os.path.join(self.root,'issues')
    for fn in os.listdir(issues_dir):
      issue_path = os.path.join(issues_dir,fn)
      issue_fn = os.path.join(issue_path,'issue.json')
      if os.path.isfile(issue_fn):
        with open(issue_fn,'r') as f:
          issue = json.load(f)
          issue['_authors'] = []
          issue['__path'] = issue_path
          comments_dir = os.path.join(issue_path,'comments')
          if os.path.isdir(comments_dir):
            for cfn in os.listdir(comments_dir):
              cfn = os.path.join(issue_path,'comments',cfn)
              with open(cfn,'r') as cf:
                comment = json.load(cf)
                comment['_authors'] = []
                comment['_text'] = bleach.clean(markdown.markdown(comment['text']))
                self._index_comment(comment)
          yield issue
  
  def _index_comment(self, comment):
    self._comments_by_id[uuid.UUID(comment['id'])] = comment
    self._comment_ids_by_issue_id[uuid.UUID(comment['issue_id'])].add(uuid.UUID(comment['id']))
  
  def issue(self, uid):
    issue = self._issues_by_id[uid]
    comments = [self._comments_by_id[cid] for cid in self._comment_ids_by_issue_id[uuid.UUID(issue['id'])]]
    comments.sort(cmp_comments)
    print '\n'.join([str(c) for c in comments])
    issue['_comments'] = comments
    return issue
  
  def _issue_path(self, uid):
    uid = uuid.UUID(uid)
    return self._issues_by_id[uid]['__path']
  
  def save_issue(self, issue):
    if 'id' in issue:
      uid = uuid.UUID(issue['id'])
      fn = os.path.join(self._issue_path(issue['id']),'issue.json')
      issue['type'] = 'issue'
      issue = self._save(issue, fn)
      self._issues_by_id[uid].update(issue)
    else:
      uid = uuid.uuid4()
      issue['id'] = str(uid)
      issues_dir = os.path.join(self.root,'issues')
      issue_dir = '%s--%s' % (slugify(issue['title']), issue['id'])
      issue_path = os.path.join(issues_dir, issue_dir)
      os.mkdir(issue_path)
      fn = os.path.join(issue_path,'issue.json')
      issue['type'] = 'issue'
      issue = self._save(issue, fn)
      issue['__path'] = issue_path
      self._issues_by_id[uid] = issue
    return issue
  
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
    return os.path.join(comment_path, '%s--%s.json' % (slugify(comment['text']), comment['id']))

  def save_comment(self, comment):
    if 'id' in comment: comment['id'] = str(uuid.UUID(comment['id']))
    else: comment['id'] = str(uuid.uuid4())
    comment['issue_id'] = str(uuid.UUID(comment['issue_id']))
    fn = self._get_comment_path(comment)
    comment = self._save(comment, fn)
    comment['_text'] = bleach.clean(markdown.markdown(comment['text']))
    comment['type'] = 'comment'
    issue = self._issues_by_id[uuid.UUID(comment['issue_id'])]
    self._index_comment(comment)
    return comment


  def _save(self, o, fn):
    o = o.copy()
    created = not os.path.isfile(fn)
    if created: o['created_on'] = int(time.time())
    with open(fn,'w') as f:
      for k in o.keys():
        if k.startswith('_'):
          del o[k]
      json.dump(o,f, sort_keys=True, indent=4)
    if created:
      project_dir = os.path.dirname(self.root)
      repo = git.Repo(project_dir)
      print 'adding', fn
      repo.index.add([fn])
    return o

def find_root(path):
  candidate = os.path.join(path,'.dit')
  if os.path.isdir(candidate):
    return candidate
  if path=='/': return None
  return os.path.dirname(path)
    
    
def slugify(s):
  return '-'.join(re.split(r'\W+', s))[:30].strip('-')


def get_timestamps(o):
  timestamps = [o.get('_committed_on'), o.get('created_on')]
  return [ts for ts in timestamps if ts]

def cmp_comments(a,b):
  return cmp(get_timestamps(a), get_timestamps(b))
  
  
