import collections, datetime, os, re, subprocess, sys, uuid, yaml
import dateutil.parser, dateutil.tz
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
    self.update_dirty()
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
        
  def update_dirty(self):
    fns = subprocess.check_output(['git','diff','HEAD','--name-only',self.dir]).strip().split()
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
      self.id = str(uuid.uuid4())
      for x, default in self.to_save.items():
        setattr(self, x, default)
      self.author = None
      self.created_at = datetime.datetime.now(dateutil.tz.tzlocal())
      self.updated_at = self.created_at

  def short_id(self):
    for i in range(5,len(self.id)):
      items = list(self.idx.trie.items(self.id[:i]))
      if len(items)<=1:
        return self.id[:i]

  def save(self):
    cls = self.__class__
    add = False
    self.updated_at = datetime.datetime.now(dateutil.tz.tzlocal())
    if not self.fn:
      self.fn = os.path.join(self.idx.dir, cls.dir_name, "%s-%s.yaml" % (self.short_id(), slugify(getattr(self,cls.slug_name))))
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
    if add:
      subprocess.check_call(['git', 'add', self.fn])
    self.idx.index(self)
    self.idx.update_dirty()

  def as_dict(self):
    short_id = self.short_id()
    d = {
      'id': self.id,
      'short_id': short_id,
      'dirty': self.fn in self.idx.dirty,
      'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
      'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S %Z'),
    }
    if hasattr(self,'author'):
      d['author'] = self.author.as_dict() if self.author else None
    return d


class Issue(Item):
  dir_name = 'issues'
  to_save = {'title':''}
  slug_name = 'title'

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
    return c-1
  
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
    d['resolved'] = self.is_resolved()
    return d
  
  def new_comment(self):
    comment = Comment(self.idx)
    comment.author = self.idx.account
    comment.reply_to = self.id
    return comment
    

class Comment(Item):
  dir_name = 'comments'
  to_save = {'reply_to':None, 'text':'', 'kind':None}
  slug_name = 'text'

  def __init__(self, idx, fn=None):
    super(self.__class__, self).__init__(idx, fn=fn)
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['reply_to'] = self.reply_to
    d['text'] = self.text
    d['kind'] = self.kind
    d['comments'] = [comment.as_dict() for comment in self.idx.get_comments(self.id)]
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
  to_save = {'email':None, 'name':'', 'aka':None}
  slug_name = 'name'

  def __init__(self, idx, fn=None):
    super(self.__class__, self).__init__(idx, fn=fn)
  
  def as_dict(self):
    d = super(self.__class__, self).as_dict()
    d['email'] = self.email
    d['name'] = self.name
    return d
  

def slugify(s):
  s = s.lower()
  return '-'.join(re.split(r'\W+', s))[:30].strip('-')

