import os, re, sys, uuid, yaml

import patricia

class Index(object):

  def __init__(self):
    self.dir = self.find_dit_dir()
    print 'found dit at', self.dir
    self.prep_dir()
    self.trie = patricia.trie()
    self.index_all()

  def __getitem__(self, key): 
    return self.trie[list(self.trie.iter(key))[0]]
    
  def prep_dir(self):
    if not os.path.isdir(os.path.join(self.dir, 'issues')):
      os.makedirs(os.path.join(self.dir, 'issues'))
    if not os.path.isdir(os.path.join(self.dir, 'comments')):
      os.makedirs(os.path.join(self.dir, 'comments'))

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
  
  def index_comment(self, comment):
    self.trie[comment.id] = comment
    if comment.issue_id:
      issue = self.trie[comment.issue_id]
      if issue:
        issue.comments.append(comment)
  
  def issues(self):
    return [item for item in self.trie.values() if isinstance(item,Issue)]
  
  def new_issue(self):
    return Issue(self)


class Item(object):
  def short_id(self):
    for i in range(4,len(self.id)):
      items = list(self.idx.trie.items(self.id[:i]))
      if len(items)<=1:
        return self.id[:i]


class Issue(Item):

  def __init__(self, idx, fn=None):
    self.fn = fn
    self.idx = idx
    self.comments = []
    if fn and os.path.isfile(fn):
      with open(fn) as f:
        data = yaml.load(f)
        self.id = data['id']
        self.title = data['title']
    else:
      self.id = str(uuid.uuid4())
      self.title = ''
  
  def as_dict(self):
    short_id = self.short_id()
    d = {
      'id': self.id,
      'title': self.title,
      'short_id': short_id,
      'url': '/issues/%s' % short_id,
      'comments_url': '/issues/%s/comments.json' % short_id,
    }
    return d
  
  def save(self):
    if not self.fn:
      self.fn = os.path.join(self.idx.dir, 'issues', "%s-%s.yaml" % (self.short_id(), slugify(self.title)))
    with open(self.fn, 'w') as f:
      data = {
        'id': self.id,
        'title': self.title,
      }
      yaml.dump(data, f, default_flow_style=False)
    self.idx.index_issue(self)

  def new_comment(self):
    comment = Comment(self.idx)
    comment.issue_id = self.id
    return comment
    

class Comment(Item):

  def __init__(self, idx, fn=None):
    self.fn = fn
    self.idx = idx
    if fn and os.path.isfile(fn):
      with open(fn) as f:
        data = yaml.load(f)
        self.id = data['id']
        self.issue_id = data['issue_id']
        self.text = data['text']
    else:
      self.id = str(uuid.uuid4())
      self.issue_id = ''
      self.text = ''
  
  def as_dict(self):
    short_id = self.short_id()
    d = {
      'id': self.id,
      'issue_id': self.issue_id,
      'text': self.text,
      'short_id': short_id,
    }
    return d
  
  def save(self):
    if not self.fn:
      self.fn = os.path.join(self.idx.dir, 'comments', "%s-%s.yaml" % (self.short_id(), slugify(self.text)))
    with open(self.fn, 'w') as f:
      data = {
        'id': self.id,
        'issue_id': self.issue_id,
        'text': self.text,
      }
      yaml.dump(data, f, default_flow_style=False)
    self.idx.index_comment(self)

def slugify(s):
  return '-'.join(re.split(r'\W+', s))[:30].strip('-')

