from __future__ import division

import collections, datetime, hashlib, itertools, mimetypes, os, random, re, shlex, subprocess, sys, uuid, yaml
import dateutil.parser, dateutil.tz
import git
import patricia

class Index(object):

  def __init__(self):
    self.dir = self.find_dit_dir()
    print 'found dit at', self.dir
    self.base_dir = os.path.dirname(self.dir)
    self.repo = git.Repo(self.base_dir)
    self.prep_dir()
    self.email = subprocess.check_output(['git','config','user.email']).strip()
    self.account = None
    self.load_all()
    self.update_dirty()
    self.check_critical()
  
  def check_critical(self):
    if not self.account:
      self.account = User(self)
      self.account.email = self.email
      self.account.name = subprocess.check_output(['git','config','user.name']).strip()
      self.account.save()

  def __getitem__(self, key):
    if not key: return None
    key = key.split('-')[0]
    matches = list(self.trie.iter(key))
    return self.trie[matches[0]] if matches else None
    
  def status(self):
    stats = {
      'dirty': self.repo.is_dirty(),
      'dirty_fns': list(self.dirty) + list(self.added),
    }
    return stats
    
  def search(self, q, kinds=None):
    try:
      qa = shlex.split(q)
    except:
      qa = tokenize(q)
    result_ids = collections.defaultdict(int)
    for t in qa:
      if not t: continue
      cls = None
      if t.startswith('label:'):
        t = t[6:]
        cls = 'label'
      for uid in self.trie.iter(t):
        result_ids[uid] += 1
      for key in self.search_trie.iter(t):
        for uid in self.search_trie[key]:
          if cls=='label':
            o = self[uid]
            if not (isinstance(o,Label) or (isinstance(o,Comment) and o.label)):
              continue
          result_ids[uid] += 1
    if kinds:
      for uid in result_ids.keys():
        if self[uid].__class__.__name__ not in kinds:
          del result_ids[uid]
    uids = [uid for uid,count in sorted(result_ids.items(), lambda x,y: cmp(y[1], x[1]))]
    return [self.trie[uid].as_dict() for uid in uids]
    
  def index_text(self, uid, vals):
    for val in vals:
      short_val = val[:256]
      if short_val not in self.search_trie:
        self.search_trie[short_val] = set()
      self.search_trie[short_val].add(uid)
      for t in tokenize(val):
        if t not in self.search_trie:
          self.search_trie[t] = set()
        self.search_trie[t].add(uid)
    
  def prep_dir(self):
    for fn in ['issues','comments','users','labels','assets']:
      if not os.path.isdir(os.path.join(self.dir, fn)):
        os.makedirs(os.path.join(self.dir, fn))
        
  def update_dirty(self):
    dirty = set()
    for diff in self.repo.index.diff(None):
      if diff.a_blob:
        dirty.add(diff.a_blob.path)
      if diff.b_blob:
        dirty.add(diff.b_blob.path)
    self.dirty = set([fn for fn in dirty if fn.startswith('.dit')])
    added = set()
    for diff in self.repo.index.diff(self.repo.head.commit):
      if diff.a_blob:
        added.add(diff.a_blob.path)
      if diff.b_blob:
        added.add(diff.b_blob.path)
    self.added = set([fn for fn in added if fn.startswith('.dit')])

  def find_dit_dir(self):
    dir = os.getcwd()
    while True:
      if os.path.isdir(os.path.join(dir, '.git')) or os.path.isdir(os.path.join(dir, '.hg')):
        dit_dir = os.path.join(dir, '.dit')
        if not os.path.isdir(dit_dir):
          os.makedirs(dit_dir)
        return dit_dir
      parent = os.path.dirname(dir)
      if parent==dir:
        raise Exception('no git repo found')
      dir = parent

  def clear_index(self):
    self.trie = patricia.trie()
    self.search_trie = patricia.trie()
    self.comments = collections.defaultdict(set)
    self.fns = {}
    
  def index_purge_fn(self, fn):
    if not fn in self.fns: return
    o = self.fns[fn]
    del self.fns[fn]
    self.index_purge(o)
    
  def index_purge(self, o):
    for k,v in self.trie.items():
      if v==o:
        del self.trie[k]
    for k,v in self.comments.items():
      self.comments[k] = set([x for x in v if x.id!=o.id])

  def load_all(self):
    self.clear_index()
    for dir in ['users','issues','labels','comments','assets']:
      for fn in os.listdir(os.path.join(self.dir, dir)):
        if not fn.endswith('.yaml'): continue
        fn = os.path.join(self.dir, dir, fn)
        o = self.load_fn(fn)
        self.index(o)

  def load_fn(self, fn):
    dir = os.path.basename(os.path.dirname(fn))
    try:
      if dir=='users': o = User(self, fn=fn)
      if dir=='issues': o = Issue(self, fn=fn)
      if dir=='labels': o = Label(self, fn=fn)
      if dir=='comments': o = Comment(self, fn=fn)
      if dir=='assets': o = Asset(self, fn=fn)
      return o
    except Exception as e:
      print 'could not load', fn
      raise e

  def index_issue(self, issue):
    self.index_text(issue.id, [issue.title])
  
  def index_user(self, user):
    user_id = user.id
    email = user.email
    seen = set()
    while user.aka and user.id not in seen:
      seen.add(user.id)
      user = self.trie[user.aka]
    if self.email == email:
      self.account = user
    self.index_text(user.id, [user.name, user.email])
  
  def index_comment(self, comment):
    if comment.reply_to:
      self.comments[comment.reply_to].add(comment)
    self.index_text(comment.id, [comment.text])
    if comment.label:
      label = self[comment.label]
      if label:
        self.index_text(comment.id, [label.name])

  def index_label(self, label):
    self.index_text(label.id, [label.name])

  def index_asset(self, asset):
    pass

  def index(self, o):
    self.trie[o.id] = o
    if o.fn:
      self.fns[o.fn[len(self.base_dir)+1:]] = o
    if isinstance(o, User): self.index_user(o)
    if isinstance(o, Comment): self.index_comment(o)
    if isinstance(o, Issue): self.index_issue(o)
    if isinstance(o, Label): self.index_label(o)
    if isinstance(o, Asset): self.index_asset(o)
  
  def issues(self):
    return [item for item in self.trie.values() if isinstance(item,Issue)]
  
  def labels(self):
    return [item for item in self.trie.values() if isinstance(item,Label)]
  
  def all_comments(self):
    return [item for item in self.trie.values() if isinstance(item,Comment)]
  
  def users(self):
    return [item for item in self.trie.values() if isinstance(item,User)]
  
  def new_issue(self):
    issue = Issue(self)
    issue.author = self.account.id
    return issue
    
  def new_label(self):
    label = Label(self)
    label.author = self.account.id
    return label
  
  def save_asset(self, data, mime_type):
    m = hashlib.sha256()
    m.update(data)
    uid = m.hexdigest()
    asset = self[uid]
    if asset:
      return asset
    asset = Asset(self)
    asset.id = uid
    asset.mime_type = mime_type
    asset.ext = mimetypes.guess_extension(asset.mime_type).strip('.')
    fn = os.path.join(self.dir, asset.dir_name, '%s.%s' % (asset.id, asset.ext))
    with open(fn,'wb') as f:
      f.write(data)
    asset.save()
    return asset
    
  def create(self, cls):
    if cls=='Label':
      return Label(self)
    
  def get_comments(self, id):
   return sorted(list(self.comments[id]), lambda x,y: cmp(x.created_at, y.created_at))
   
  def revert_all(self):
    added = list(self.added)
    self.repo.git.reset(added)
    for fn in added:
      os.remove(os.path.join(self.base_dir, fn))
    to_revert = [fn for fn in self.dirty if fn.startswith('.dit/') and os.path.exists(os.path.join(self.base_dir, fn))]
    self.repo.git.checkout(*(['--'] + to_revert))
    self.update_dirty()
    for fn in to_revert + added:
      self.index_purge_fn(fn)
      if os.path.exists(os.path.join(self.base_dir,fn)):
        o = self.load_fn(os.path.join(self.base_dir,fn))
        self.index(o)

  def commit(self, id):
    o = self[id]
    fn = o.fn[len(self.base_dir)+1:]
    self.index_purge(o)
    self.repo.git.commit(fn, m='dit commit')
    if os.path.exists(o.fn):
      o = self.load_fn(o.fn)
      self.index(o)
    self.update_dirty()

  def revert(self, id):
    o = self[id]
    fn = o.fn[len(self.base_dir)+1:]
    self.index_purge(o)
    print 'reverting', fn
    if fn in self.added:
      self.repo.git.reset(fn)
      os.remove(o.fn)
    else:
      self.repo.git.checkout('--', fn)
    if os.path.exists(o.fn):
      o = self.load_fn(o.fn)
      self.index(o)
    self.update_dirty()

  def commit_all(self):
    to_commit = [fn for fn in (self.dirty|self.added) if fn.startswith('.dit/')]
    self.repo.git.commit(*to_commit, m='dit commit all')
    self.update_dirty()
    for fn in to_commit:
      self.index_purge_fn(fn)
      if os.path.exists(os.path.join(self.base_dir,fn)):
        o = self.load_fn(os.path.join(self.base_dir,fn))
        self.index(o)
      


class Item(object):

  def __init__(self, idx, fn=None):
    self.fn = fn
    self.idx = idx
    if fn and os.path.isfile(fn):
      with open(fn) as f:
        data = yaml.load(f)
        self.id = data['id']
        for x, default in self.to_save.items():
          setattr(self, x, data.get(x, default))
        self.author = data.get('author')
        self.created_at = dateutil.parser.parse(data['created_at'])
        self.updated_at = dateutil.parser.parse(data['updated_at'])
    else:
      self.id = str(uuid.uuid4()).replace('-','')
      for x, default in self.to_save.items():
        setattr(self, x, default)
      self.author = None
      self.created_at = datetime.datetime.now(dateutil.tz.tzlocal())
      self.updated_at = self.created_at

  def short_id(self):
    min_length = self.short_seed_size if hasattr(self,'short_seed_size') else 5
    return self.gen_short_id(self.id, min_length=min_length)
  
  def gen_short_id(self, uid, min_length=5):
    for i in range(min_length, len(uid)):
      items = list(self.idx.trie.items(uid[:i]))
      if len(items)<=1:
        return uid[:i]

  def save(self):
    cls = self.__class__
    add = False
    self.updated_at = datetime.datetime.now(dateutil.tz.tzlocal())
    if not self.fn:
      self.fn = os.path.join(self.idx.dir, cls.dir_name, "%s-%s.yaml" % (self.short_id(), slugify(self.slug_seed())))
      add = True
    with open(self.fn, 'w') as f:
      data = {
        'id': self.id,
        'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
        'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
      }
      for x in self.__class__.to_save.keys():
        data[x] = getattr(self,x)
      if hasattr(self,'author') and self.author:
        data['author'] = self.author
      yaml.dump(data, f, default_flow_style=False)
      print 'wrote', self.fn
      self.idx.fns[self.fn[len(self.idx.base_dir)+1:]] = self
    if add:
      subprocess.check_call(['git', 'add', self.fn])
    self.idx.index(self)
    self.idx.update_dirty()

  def as_dict(self):
    short_id = self.short_id()
    d = {
      'id': self.id,
      '__class__': self.__class__.__name__,
      'short_id': short_id,
      'slug': slugify(short_id +' '+ self.slug_seed()),
      'dirty': False,
      'new': not self.fn,
      'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
      'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
    }
    if self.fn:
      rel_fn = self.fn[len(self.idx.base_dir)+1:]
      d['dirty'] = rel_fn in self.idx.added or rel_fn in self.idx.dirty
    if hasattr(self,'author'):
      author = self.idx[self.author]
      d['author'] = author.as_dict() if author else None
    return d
  
  def allow_update(self, k):
    if not hasattr(self.__class__, 'updatable'):
      return False
    return k in self.__class__.updatable


class Issue(Item):
  dir_name = 'issues'
  to_save = {'title':''}
  updatable = set(['title'])

  def __init__(self, idx, fn=None):
    super(self.__class__, self).__init__(idx, fn=fn)
    
  def comment_count(self):
    c = 0
    to_count = [self]
    while len(to_count):
      x = to_count.pop()
      comments = [y for y in self.idx.comments[x.id] if y.text]
      if comments:
        c += len(comments)
        to_count += comments
    return max(0,c-1)

  def get_owners(self):
    owners = set()
    for comment in self.idx.get_comments(self.id):
      if comment.kind=='assigned':
        owners.add(comment.assignee)
      if comment.kind=='unassigned':
        owners.discard(comment.assignee)
    return [self.idx[uid] for uid in owners]

  def participants(self):
    user_ids = set()
    user_ids.add(self.author)
    for comment in self.iter_comments():
      user_ids.add(comment.author)
    users = {id:self.idx[id] for id in user_ids}
    return users
  
  def iter_comments(self):
    to_count = [self]
    while len(to_count):
      x = to_count.pop()
      comments = [y for y in self.idx.get_comments(x.id)]
      for comment in comments:
        yield comment
      to_count += comments
  
  def resolved(self):
    resolved = collections.defaultdict(int)
    for comment in self.idx.get_comments(self.id):
      if comment.kind=='resolved':
        resolved[comment.author] += 1
      if comment.kind=='reopened':
        resolved[comment.author] -= 1
    for user_id, weight in resolved.items():
      if weight == 0:
        del resolved[user_id]
    if len(resolved)==0: return resolved, 0
    return resolved, sum([max(0,min(w,1)) for w in resolved.values()]) / len(resolved)
    
  def get_annotated_labels(self):
    label_user_weights = collections.defaultdict(lambda: collections.defaultdict(int))
    for comment in self.idx.get_comments(self.id):
      if comment.kind=='added_label':
        label_user_weights[comment.label][comment.author] += 1
      elif comment.kind=='removed_label':
        label_user_weights[comment.label][comment.author] -= 1
    for label_id, user_weights in label_user_weights.items():
      for user_id, weight in user_weights.items():
        if weight == 0:
          del user_weights[user_id]
    label_weights = {}
    for label_id, user_weights in label_user_weights.items():
      if not len(user_weights): continue
      label_weights[label_id] = sum([max(0,min(w,1)) for w in user_weights.values()]) / len(user_weights)
    labels = [self.idx[label_id] for label_id in label_weights.keys() if label_id]
    labels = [label for label in labels if label]
    return labels, label_user_weights, label_weights
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['title'] = self.title
    d['url'] = '/issues/%s' % d['short_id']
    d['comments_url'] = '/issues/%s/comments.json' % (self.id if d['new'] else d['short_id'])
    d['comment_count'] = self.comment_count()
    labels, label_user_weights, label_weights = self.get_annotated_labels()
    d['labels'] = [label.as_dict() for label in labels if label_weights[label.id]>0]
    d['label_weights'] = {label.id:label_weights[label.id] for label in labels}
    d['my_label_weights'] = {label.id:label_user_weights[label.id][self.idx.account.id] for label in labels}
    d['label_user_weights'] = label_user_weights
    resolved_by_user, resolved = self.resolved()
    d['resolved'] = resolved
    d['resolved_by_user'] = resolved_by_user
    d['i_resolved'] = resolved_by_user[self.idx.account.id]
    d['participants'] = {uid:p.as_dict() for uid,p in self.participants().items()}
    d['owners'] = [o.as_dict() for o in self.get_owners()]
    return d
  
  def new_comment(self):
    comment = Comment(self.idx)
    comment.author = self.idx.account.id
    comment.reply_to = self.id
    return comment

  def slug_seed(self):
    return self.title
    

class Comment(Item):
  dir_name = 'comments'
  to_save = {'reply_to':None, 'text':'', 'kind':None, 'label':None, 'assignee':None}
  updatable = set(['text'])
  short_seed_size = 8

  def __init__(self, idx, fn=None):
    super(self.__class__, self).__init__(idx, fn=fn)
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['reply_to'] = self.reply_to
    d['reply_to_short_id'] = self.gen_short_id(self.reply_to)
    reply_to_desc = d['reply_to_short_id']
    reply_to = self.idx[self.reply_to]
    if isinstance(reply_to, Issue):
      reply_to_desc = reply_to.title
    d['reply_to_desc'] = reply_to_desc
    d['text'] = self.text
    d['kind'] = self.kind
    label = self.idx[self.label] if self.label else None
    d['label'] = label.as_dict() if label else None
    if self.assignee:
      assignee = self.idx[self.assignee]
      d['assignee'] = assignee.as_dict() if assignee else None
    d['comments'] = [comment.as_dict() for comment in self.idx.get_comments(self.id)]
    return d

  def new_comment(self):
    comment = Comment(self.idx)
    comment.author = self.idx.account.id
    comment.reply_to = self.id
    return comment

  def slug_seed(self):
    target = None
    if self.label:
      target = self.idx[self.label]
    if self.assignee:
      target = self.idx[self.assignee]
    if target:
      return '%s %s' % (self.kind, target.name)
    return self.text
    
  def get_issue(self):
    x = self
    while x:
      if isinstance(x, Issue):
        return x
      x = self.idx[x.reply_to]
  

class User(Item):
  dir_name = 'users'
  to_save = {'email':None, 'name':'', 'aka':None}

  def __init__(self, idx, fn=None):
    super(self.__class__, self).__init__(idx, fn=fn)
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['email'] = self.email
    d['name'] = self.name
    return d

  def slug_seed(self):
    return self.name
  

class Label(Item):
  dir_name = 'labels'
  to_save = {'name':'', 'fg_color':None, 'bg_color':None, 'deadline':None}
  updatable = set(['name', 'fg_color', 'bg_color', 'deadline'])

  def __init__(self, idx, fn=None):
    super(self.__class__, self).__init__(idx, fn=fn)
    if not self.fg_color and not self.bg_color:
      self.fg_color, self.bg_color = random_color()
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['name'] = self.name
    d['fg_color'] = self.fg_color
    d['bg_color'] = self.bg_color
    return d
    
  def slug_seed(self):
    return self.name
  

class Asset(Item):
  dir_name = 'assets'
  to_save = {'mime_type':None, 'ext':'dat'}
  short_seed_size = 12
  updatable = set()

  def __init__(self, idx, fn=None):
    super(self.__class__, self).__init__(idx, fn=fn)
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['url'] = '/assets/%s.%s' % (self.short_id(),self.ext)
    d['mime_type'] = self.mime_type
    return d
    
  def slug_seed(self):
    return self.mime_type
  
  def read(self):
    fn = os.path.join(self.idx.dir, self.dir_name, '%s.%s' % (self.id, self.ext))
    with open(fn,'rb') as f:
      return f.read()
  

def slugify(s):
  s = s.lower()
  return '-'.join(re.split(r'\W+', s))[:30].strip('-')

def tokenize(s):
  s = s.lower()
  return re.split(r'\W+', s)

def random_color():
  components = [random.randint(0,255) for i in range(3)]
  fg_color = '#ffffff' if sum(components)/3 < 150 else '#000000'
  bg_color = '#' + ''.join(['%02x'%c for c in components])
  return fg_color, bg_color
