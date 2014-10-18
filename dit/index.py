import bleach, collections, git, json, markdown, os, re, time, traceback, uuid

bleach.ALLOWED_TAGS.append('p')

class Index(object):

  def __init__(self):
    self.root = find_root(os.getcwd())
    print 'dit root:', self.root
    self.repo_root = os.path.dirname(self.root)
    self._objects_by_id = collections.defaultdict(dict)
    self._comment_ids_by_issue_id = collections.defaultdict(set)
    self._commits_by_issue_id = collections.defaultdict(list)
    self._authors_by_id = collections.defaultdict(list)
    self._meta_by_id = collections.defaultdict(dict)
    self._path_by_id = {} # rel to repo base
    self._id_by_path = {}
    self._load_issues()
    self.index_history()
    print 'len(self._objects_by_id)', len(self._objects_by_id)
    print 'len(self._comment_ids_by_issue_id)', len(self._comment_ids_by_issue_id)
    print 'len(self._commits_by_issue_id)', len(self._commits_by_issue_id)
  
  def index_history(self):
    def index(commit, diff, blob):
      if blob is None: return
      if not blob.path.startswith('.dit/'): return
      if not blob.path.endswith('.json'): return
      uid = None
      try:
        o = json.load(blob.data_stream)
        uid = uuid.UUID(o['id'])
        self._path_by_id[uid] = blob.path
        self._id_by_path[blob.path] = uid
      except Exception as e:
        traceback.print_exc()
        print 'could not decode', blob.path
      if uid:
        author = str(commit.author)
        print 'author', author
        meta = self._meta_by_id[uid]
        if '_authors' not in meta: meta['_authors'] = []
        if author not in meta['_authors']:
          meta['_authors'].append(author)
        meta['_commit_id'] = commit.hexsha
        meta['_committed_on'] = commit.committed_date
    repo = git.Repo(self.repo_root)
    try:
      c = 0
      for commit in repo.iter_commits():
        c += 1
        files = commit.stats.files
        add_to_issues = set()

        for match in ISSUE_ID_RE.findall(commit.message):
          issue_id = uuid.UUID(match[1:])
          add_to_issues.add(issue_id)

        found_non_dit_file = False
        conditional_add_to_issues = set()
        for fn in files.keys():
          if not fn.startswith('.dit/'):
            found_non_dit_file = True
            continue
          oid = self._id_by_path[fn]
          if not oid: continue
          o = self._objects_by_id[oid]
          if not o: continue
          dname = os.path.basename(os.path.dirname(fn))
          if o.get('type')=='issue' or dname=='issues':
            conditional_add_to_issues.add(uuid.UUID(o['id']))
          if o.get('type')=='comment' or dname=='comments':
            conditional_add_to_issues.add(uuid.UUID(o['issue_id']))
        if found_non_dit_file:
          add_to_issues |= conditional_add_to_issues
            
        for issue_id in add_to_issues:
          self._commits_by_issue_id[issue_id].append({
            'hexsha': commit.hexsha,
            '_committed_on': commit.committed_date,
            'files': {k:v for k,v in files.items() if not k.startswith('.dit/')},
            'message': commit.message,
            'type': 'commit',
          })
          
        for o in commit.tree.traverse():
          if not isinstance(o, git.objects.blob.Blob): continue
          if o.path not in files: continue
          index(commit, None, o)
          print o.path

      print 'indexed', c, 'commits'
      
      for diff in repo.index.diff(None):
        self._meta_by_id[self._id_by_path[diff.a_blob.path]]['_dirty'] = True
      print self._id_by_path
      for path in repo.git.diff("--cached", "--name-only", "--diff-filter=A").split('\n'):
        if not path.startswith('.dit/'): continue
        if not path.endswith('.json'): continue
        self._meta_by_id[self._id_by_path[path]]['_dirty'] = True
        
      
    except ValueError as e:
      # message: Reference at 'refs/heads/master' does not exist
      # this happens when a repo has no commits (brand new after init)
      print e
      pass
      
    
  
  def repo(self):
    repo = git.Repo(self.repo_root)
    return {
      'project_dir': self.repo_root,
      'project': os.path.split(self.repo_root)[-1],
      'origin': repo.remotes.origin.url if len(repo.remotes) else '(no origin)',
      'dit_version': '0.1',
      'branch': repo.head.reference.name,
      'is_dirty': repo.is_dirty(),
    }
    
  def issues(self):
    issues = [issue for issue in self._objects_by_id.values() if issue['type']=='issue']
    for issue in issues:
      issue['_comments'] = ['' for cid in self._comment_ids_by_issue_id[uuid.UUID(issue['id'])]]
    return issues

  def _load_object(self, fn):
    with open(fn,'r') as f:
      o = json.load(f)
      uid = uuid.UUID(o.get('id'))
      self._objects_by_id[uid] = o
      if 'text' in o:
        self._meta_by_id[uid]['_text'] = bleach.clean(markdown.markdown(o['text']))
      if 'type' not in o:
        dname = os.path.basename(os.path.dirname(fn))
        print 'dname', dname
        if dname=='issues': o['type'] = 'issue'
        if dname=='comments': o['type'] = 'comment'
      self._path_by_id[uid] = fn[len(self.repo_root)+1:]
      self._id_by_path[self._path_by_id[uid]] = uid
      return o
    
  def _load_issues(self):
    issues_dir = os.path.join(self.root,'issues')
    if not os.path.isdir(issues_dir): return
    for fn in os.listdir(issues_dir):
      issue_path = os.path.join(issues_dir,fn)
      issue_fn = os.path.join(issue_path,'issue.json')
      if os.path.isfile(issue_fn):
        issue = self._load_object(issue_fn)
        if 'type' not in issue: issue['type'] = 'issue'
        comments_dir = os.path.join(issue_path,'comments')
        if os.path.isdir(comments_dir):
          for cfn in os.listdir(comments_dir):
            cfn = os.path.join(issue_path,'comments',cfn)
            comment = self._load_object(cfn)
            if 'type' not in comment: comment['type'] = 'comment'
            self._index_comment(comment)
  
  def _index_comment(self, comment):
    self._objects_by_id[uuid.UUID(comment['id'])].update(comment)
    self._comment_ids_by_issue_id[uuid.UUID(comment['issue_id'])].add(uuid.UUID(comment['id']))
  
  def issue(self, uid):
    issue = self._objects_by_id[uid]
    issue.update(self._meta_by_id[uid])
    comments = [self._objects_by_id.get(cid) for cid in self._comment_ids_by_issue_id[uuid.UUID(issue['id'])]]
    comments = [comment for comment in comments if comment is not None]
    for comment in comments:
      comment.update(self._meta_by_id[uuid.UUID(comment['id'])])
    comments += self._commits_by_issue_id[uid]
    comments.sort(cmp_comments)
    print '\n'.join([str(c) for c in comments])
    issue['_comments'] = comments
    return issue
  
  def _issue_dir_full(self, uid):
    uid = uuid.UUID(uid)
    return os.path.dirname(os.path.join(self.repo_root, self._path_by_id[uid]))
  
  def save_issue(self, issue):
    if 'id' in issue:
      uid = uuid.UUID(issue['id'])
      fn = os.path.join(self._issue_dir_full(issue['id']),'issue.json')
      issue['type'] = 'issue'
      issue = self._save(issue, fn)
      self._objects_by_id[uid].update(issue)
    else:
      uid = uuid.uuid4()
      issue['id'] = str(uid)
      issues_dir = os.path.join(self.root,'issues')
      if not os.path.isdir(issues_dir):
        os.mkdir(issues_dir)
      issue_dir = '%s--%s' % (slugify(issue['title']), issue['id'])
      issue_path = os.path.join(issues_dir, issue_dir)
      os.mkdir(issue_path)
      fn = os.path.join(issue_path,'issue.json')
      issue['type'] = 'issue'
      issue = self._save(issue, fn)
      self._objects_by_id[uid] = issue
    return issue
  
  def _get_comment_path(self, comment):
    uid = uuid.UUID(comment['id'])
    if uid in self._path_by_id: return self._path_by_id[uid]
    comment_path = os.path.join(self._issue_dir_full(comment['issue_id']),'comments')
    if not os.path.isdir(comment_path):
      os.mkdir(comment_path)
    return os.path.join(comment_path, '%s--%s.json' % (slugify(comment['text']), comment['id']))

  def save_comment(self, comment):
    if 'id' in comment:
      uid = uuid.UUID(comment['id'])
    else:
      uid = uuid.uuid4()
      comment['id'] = str(uid)
    comment['issue_id'] = str(uuid.UUID(comment['issue_id']))
    comment['type'] = 'comment'
    fn = self._get_comment_path(comment)
    comment = self._save(comment, fn)
    self._meta_by_id[uid]['_text'] = bleach.clean(markdown.markdown(comment['text']))
    comment.update(self._meta_by_id[uid])
    self._path_by_id[uid] = fn[len(self.repo_root)+1:]
    self._id_by_path[self._path_by_id[uid]] = uid
    print 'self._path_by_id', self._path_by_id, uid
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
      repo = git.Repo(self.repo_root)
      print 'adding', fn
      repo.index.add([fn])
    uid = uuid.UUID(o['id'])
    self._meta_by_id[uid]['_dirty'] = True
    o.update(self._meta_by_id[uid])
    return o
    
  def revert(self, o):
    uid = uuid.UUID(o.get('id'))
    path = self._path_by_id.get(uid)
    print 'reverting', uid, 'at', path
    repo = git.Repo(self.repo_root)
    if path in repo.git.diff("--cached", "--name-only", "--diff-filter=A").split('\n'):
      repo.git.rm('--cached', path)
      os.remove(os.path.join(self.repo_root, path))
      del self._objects_by_id[uid]
      return {'_delete':True}
    else:
      repo.git.checkout(path)
      o = self._load_object(path)
      self._meta_by_id[uid]['_dirty'] = False
      o.update(self._meta_by_id[uid])
      return o
    
  def commit(self, o):
    uid = uuid.UUID(o.get('id'))
    path = self._path_by_id.get(uid)
    print 'committing', uid, 'at', path
    repo = git.Repo(self.repo_root)
    repo.git.commit(path, m='saved via dit')
    o = self._load_object(path)
    self._meta_by_id[uid]['_dirty'] = False
    o.update(self._meta_by_id[uid])
    return o
    

def find_root(path):
  candidate = os.path.join(path,'.dit')
  if os.path.isdir(candidate):
    return candidate
  if path=='/': return None
  if os.path.isdir(os.path.join(path,'.git')) or os.path.isdir(os.path.join(path,'.hg')):
    os.mkdir(candidate)
    return candidate
  if os.path.isdir(os.path.join(path,'.hg')): return None
  return find_root(os.path.dirname(path))
    
    
def slugify(s):
  return '-'.join(re.split(r'\W+', s))[:30].strip('-')


def get_timestamps(o):
  timestamps = [o.get('_committed_on',1000000000000), o.get('created_on',1000000000000)]
  return [ts for ts in timestamps if ts]

def cmp_comments(a,b):
  return cmp(get_timestamps(a), get_timestamps(b))
  

ISSUE_ID_RE = re.compile('#[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}')

