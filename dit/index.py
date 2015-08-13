import collections, datetime, itertools, os, random, re, shlex, subprocess, sys, uuid, yaml
import dateutil.parser, dateutil.tz
import patricia

class Index(object):

  def __init__(self):
    self.dir = self.find_dit_dir()
    print 'found dit at', self.dir
    self.prep_dir()
    self.trie = patricia.trie()
    self.search_trie = patricia.trie()
    self.comments = collections.defaultdict(list)
    self.email = subprocess.check_output(['git','config','user.email']).strip()
    self.account = None
    self.index_all()
    self.update_dirty()
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
    for fn in ['issues','comments','users','labels']:
      if not os.path.isdir(os.path.join(self.dir, fn)):
        os.makedirs(os.path.join(self.dir, fn))
        
  def update_dirty(self):
    try:
      fns = subprocess.check_output(['git','diff','HEAD','--name-only',self.dir]).strip().split()
    except:
      # git diff will exit 128 if it's an empty repo
      fns = []
    fns = [os.path.abspath(fn) for fn in fns]
    self.dirty = set(fns)
      

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

  def index_all(self):
    for fn in os.listdir(os.path.join(self.dir, 'users')):
      fn = os.path.join(self.dir, 'users', fn)
      user = User(self, fn=fn)
      self.index_user(user)
    for fn in os.listdir(os.path.join(self.dir, 'issues')):
      fn = os.path.join(self.dir, 'issues', fn)
      issue = Issue(self, fn=fn)
      self.index_issue(issue)
    for fn in os.listdir(os.path.join(self.dir, 'labels')):
      fn = os.path.join(self.dir, 'labels', fn)
      label = Label(self, fn=fn)
      self.index_label(label)
    for fn in os.listdir(os.path.join(self.dir, 'comments')):
      fn = os.path.join(self.dir, 'comments', fn)
      comment = Comment(self, fn=fn)
      self.index_comment(comment)
  
  def index_issue(self, issue):
    self.trie[issue.id] = issue
    self.index_text(issue.id, [issue.title])
  
  def index_user(self, user):
    user_id = user.id
    email = user.email
    seen = set()
    while user.aka and user.id not in seen:
      seen.add(user.id)
      user = self.trie[user.aka]
    self.trie[user_id] = user
    if self.email == email:
      self.account = user
    self.index_text(user.id, [user.name, user.email])
  
  def index_comment(self, comment):
    self.trie[comment.id] = comment
    if comment.reply_to:
      self.comments[comment.reply_to].append(comment)
    self.index_text(comment.id, [comment.text])
    if comment.label:
      label = self[comment.label]
      if label:
        self.index_text(comment.id, [label.name])

  def index_label(self, label):
    self.trie[label.id] = label
    self.index_text(label.id, [label.name])

  def index(self, o):
    if isinstance(o, User): self.index_user(o)
    if isinstance(o, Comment): self.index_comment(o)
    if isinstance(o, Issue): self.index_issue(o)
    if isinstance(o, Label): self.index_label(o)
  
  def issues(self):
    return [item for item in self.trie.values() if isinstance(item,Issue)]
  
  def labels(self):
    return [item for item in self.trie.values() if isinstance(item,Label)]
  
  def new_issue(self):
    issue = Issue(self)
    issue.author = self.account
    return issue
    
  def new_label(self):
    label = Label(self)
    label.author = self.account
    return label
    
  def create(self, cls):
    if cls=='Label':
      return Label(self)
    
  def get_comments(self, id):
   return sorted(self.comments[id], lambda x,y: cmp(x.created_at, y.created_at))


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
        self.author = self.idx[data['author']] if 'author' in data else None
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
    return self.gen_short_id(self.id)
  
  def gen_short_id(self, uid):
    for i in range(5,len(uid)):
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
        data['author'] = self.author.id
      yaml.dump(data, f, default_flow_style=False)
      print 'wrote', self.fn
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
      'dirty': self.fn in self.idx.dirty,
      'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
      'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
    }
    if hasattr(self,'author'):
      d['author'] = self.author.as_dict() if self.author else None
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
  
  def is_resolved(self):
    resolved = False
    for comment in self.idx.get_comments(self.id):
      if comment.kind=='resolved':
        resolved = True
      if comment.kind=='reopened':
        resolved = False
    return resolved
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['title'] = self.title
    d['url'] = '/issues/%s' % d['short_id']
    d['comments_url'] = '/issues/%s/comments.json' % d['short_id']
    d['comment_count'] = self.comment_count()
    label_ids = set()
    for comment in self.idx.get_comments(self.id):
      if comment.kind=='added_label':
        label_ids.add(comment.label)
      elif comment.kind=='removed_label':
        label_ids.discard(comment.label)
    labels = [self.idx[label_id] for label_id in label_ids if label_id]
    d['labels'] = [label.as_dict() for label in labels if label]
    d['resolved'] = self.is_resolved()
    return d
  
  def new_comment(self):
    comment = Comment(self.idx)
    comment.author = self.idx.account
    comment.reply_to = self.id
    return comment

  def slug_seed(self):
    return self.title
    

class Comment(Item):
  dir_name = 'comments'
  to_save = {'reply_to':None, 'text':'', 'kind':None, 'label':None}
  updatable = set(['text'])

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
    d['comments'] = [comment.as_dict() for comment in self.idx.get_comments(self.id)]
    return d

  def new_comment(self):
    comment = Comment(self.idx)
    comment.author = self.idx.account
    comment.reply_to = self.id
    return comment

  def slug_seed(self):
    label = self.idx[self.label] if self.label else None
    if label:
      return 'label %s' % label.name
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
