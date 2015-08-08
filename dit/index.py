import collections, os, re, subprocess, sys, uuid, yaml

import patricia

class Index(object):

  def __init__(self):
    self.dir = self.find_dit_dir()
    print 'found dit at', self.dir
    self.prep_dir()
    self.trie = patricia.trie()
    self.comments = collections.defaultdict(list)
    self.email = subprocess.check_output(['git','config','user.email']).strip()
    self.account = None
    self.index_all()
    if not self.account:
      self.account = User(self)
      self.account.email = self.email
      self.account.name = subprocess.check_output(['git','config','user.name']).strip()
      self.account.save()

  def __getitem__(self, key): 
    return self.trie[list(self.trie.iter(key))[0]]
    
  def prep_dir(self):
    for fn in ['issues','comments','users']:
      if not os.path.isdir(os.path.join(self.dir, fn)):
        os.makedirs(os.path.join(self.dir, fn))

  def find_dit_dir(self):
    dir = os.getcwd()
    while True:
      if os.path.isdir(os.path.join(dir, '.dit')):
        return os.path.join(dir, '.dit')
      parent = os.path.dirname(dir)
      if parent==dir:
        raise Exception('no .dit dir found')
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
    for fn in os.listdir(os.path.join(self.dir, 'comments')):
      fn = os.path.join(self.dir, 'comments', fn)
      comment = Comment(self, fn=fn)
      self.index_comment(comment)
  
  def index_issue(self, issue):
    self.trie[issue.id] = issue
  
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
  
  def index_comment(self, comment):
    self.trie[comment.id] = comment
    if comment.reply_to:
      self.comments[comment.reply_to].append(comment)

  def index(self, o):
    if isinstance(o, User): self.index_user(o)
    if isinstance(o, Comment): self.index_comment(o)
    if isinstance(o, Issue): self.index_issue(o)
  
  def issues(self):
    return [item for item in self.trie.values() if isinstance(item,Issue)]
  
  def new_issue(self):
    issue = Issue(self)
    issue.author = self.account
    return issue


class Item(object):

  def short_id(self):
    for i in range(5,len(self.id)):
      items = list(self.idx.trie.items(self.id[:i]))
      if len(items)<=1:
        return self.id[:i]

  def save(self):
    cls = self.__class__
    if not self.fn:
      self.fn = os.path.join(self.idx.dir, cls.dir_name, "%s-%s.yaml" % (self.short_id(), slugify(getattr(self,cls.slug_name))))
    with open(self.fn, 'w') as f:
      data = {
        'id': self.id,
      }
      for x in self.__class__.to_save:
        data[x] = getattr(self,x)
      if hasattr(self,'author'):
        data['author'] = self.author.id
      yaml.dump(data, f, default_flow_style=False)
    self.idx.index(self)


class Issue(Item):
  dir_name = 'issues'
  to_save = ['title']
  slug_name = 'title'

  def __init__(self, idx, fn=None):
    self.fn = fn
    self.idx = idx
    if fn and os.path.isfile(fn):
      with open(fn) as f:
        data = yaml.load(f)
        self.id = data['id']
        self.title = data['title']
        self.author = self.idx[data['author']] if 'author' in data else None
    else:
      self.id = str(uuid.uuid4())
      self.title = ''
      self.author = None
  
  def as_dict(self):
    short_id = self.short_id()
    d = {
      'id': self.id,
      'title': self.title,
      'short_id': short_id,
      'url': '/issues/%s' % short_id,
      'comments_url': '/issues/%s/comments.json' % short_id,
      'author': self.author.as_dict() if self.author else None,
    }
    return d
  
  def new_comment(self):
    comment = Comment(self.idx)
    comment.author = self.idx.account
    comment.reply_to = self.id
    return comment
    

class Comment(Item):
  dir_name = 'comments'
  to_save = ['reply_to','text']
  slug_name = 'text'

  def __init__(self, idx, fn=None):
    self.fn = fn
    self.idx = idx
    if fn and os.path.isfile(fn):
      with open(fn) as f:
        data = yaml.load(f)
        self.id = data['id']
        self.reply_to = data['reply_to']
        self.text = data['text']
        self.author = self.idx[data['author']] if 'author' in data else None
    else:
      self.id = str(uuid.uuid4())
      self.reply_to = ''
      self.text = ''
      self.author = None
  
  def as_dict(self):
    short_id = self.short_id()
    d = {
      'id': self.id,
      'reply_to': self.reply_to,
      'author': self.author.as_dict() if self.author else None,
      'text': self.text,
      'short_id': short_id,
      'comments': [comment.as_dict() for comment in self.idx.comments[self.id]],
    }
    return d

  def new_comment(self):
    comment = Comment(self.idx)
    comment.author = self.idx.account
    comment.reply_to = self.id
    return comment
    
  def get_issue(self):
    x = self
    while x:
      if isinstance(x, Issue):
        return x
      x = self.idx[x.reply_to]
  

class User(Item):
  dir_name = 'users'
  to_save = ['email','name','aka']
  slug_name = 'name'

  def __init__(self, idx, fn=None):
    self.fn = fn
    self.idx = idx
    if fn and os.path.isfile(fn):
      with open(fn) as f:
        data = yaml.load(f)
        self.id = data['id']
        self.email = data.get('email')
        self.name = data.get('name')
        self.aka = data.get('aka')
    else:
      self.id = str(uuid.uuid4())
      self.email = ''
      self.name = ''
      self.aka = None
  
  def as_dict(self):
    short_id = self.short_id()
    d = {
      'id': self.id,
      'email': self.email,
      'name': self.name,
      'short_id': short_id,
    }
    return d
  

def slugify(s):
  s = s.lower()
  return '-'.join(re.split(r'\W+', s))[:30].strip('-')

