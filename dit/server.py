import os

import bottle

BASE = os.path.dirname(os.path.realpath(__file__))

import index
idx = index.Index()

@bottle.get('/')
def index():
  return _html(title='Welcome', react='index')
  
@bottle.get('/issues')
def issues():
  return _html(title='Issues', react='issues')
  
@bottle.get('/issues/new')
def issues_new():
  return _html(title='New Issue', react='issues_new')
  
@bottle.get('/issues/<issue_id>.json')
def issue_json(issue_id):
  issue = idx[issue_id]
  print 'issue', issue
  return issue.as_dict()
  
@bottle.get('/issues/<issue_id>/comments.json')
def comments_json(issue_id):
  issue = idx[issue_id]
  return {
    'comments': [comment.as_dict() for comment in idx.get_comments(issue.id)],
  }
  
@bottle.get('/issues/<issue_id>')
def issue(issue_id):
  issue = idx[issue_id]
  return _html(title=issue.title, react='issue')
  
@bottle.get('/account.json')
def account_json():
  return idx.account.as_dict()
  
@bottle.post('/issues/new')
def issues_new():
  issue = idx.new_issue()
  issue.title = bottle.request.forms['title']
  issue.save()
  comment = issue.new_comment()
  comment.text = bottle.request.forms['comment']
  comment.save()
  return bottle.redirect('/issues/%s' % issue.short_id())
  
@bottle.post('/reply-to/<item_id>')
def replay(item_id):
  item = idx[item_id]
  if bottle.request.forms['comment']:
    comment = item.new_comment()
    comment.text = bottle.request.forms['comment']
    comment.save()
  if 'close' in bottle.request.forms:
    comment = item.new_comment()
    comment.kind = 'resolved'
    comment.save()
  if 'reopen' in bottle.request.forms:
    comment = item.new_comment()
    comment.kind = 'reopened'
    comment.save()
  return bottle.redirect('/issues/%s' % comment.get_issue().short_id())

@bottle.post('/update/<item_id>')
def update(item_id):
  item = idx[item_id]
  changed = False
  for k,v in bottle.request.forms.items():
    if (item.allow_update(k)):
      setattr(item,k,v)
      changed = True
  if changed:
    item.save()
  return 'ok'
  
@bottle.get('/issues.json')
def issues_json():
  return {
    'issues': [issue.as_dict() for issue in idx.issues()],
  }
  
@bottle.get('/jsx/<path>')
def jsx(path):
  with open(os.path.join(BASE, 'jsx', path)) as f:
    return f.read()
  
@bottle.get('/static/<path>')
def static(path):
  if path.endswith('.css'):
    bottle.response.content_type = 'text/css'
  if path.endswith('.js'):
    bottle.response.content_type = 'application/javascript'
  if path.endswith('.woff2'):
    bottle.response.content_type = 'application/font-woff2'
  with open(os.path.join(BASE, 'static', path)) as f:
    return f.read()
  

def _html(**kwargs):
  with open(os.path.join(BASE, 'templates', 'index.html')) as f:
    return bottle.template(f.read(), **kwargs)


if __name__=='__main__':
  bottle.run(host='localhost', port=4920)


