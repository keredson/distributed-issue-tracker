import os

import check_deps

import bottle

BASE = os.path.dirname(os.path.realpath(__file__))

import index
idx = index.Index()

@bottle.get('/')
def home():
  return _html(title='Welcome', react='index')
  
@bottle.get('/search')
def search():
  return _html(title='Search', react='search')
  
@bottle.get('/search.json')
def search_json():
  kinds = None
  if 'kind' in bottle.request.GET:
    kinds = set(bottle.request.GET['kind'].split(','))
  items = idx.search(bottle.request.GET['q'], kinds=kinds)
  return {'items': items}
  
@bottle.get('/items-by-id.json')
def items_json():
  items_by_id = {id:idx[id.split('-')[0]] for id in bottle.request.GET['ids'].split(',')}
  return {id:item.as_dict() if item else None for id,item in items_by_id.items()}
  
@bottle.get('/issues')
def issues():
  return _html(title='Issues', react='issues')
  
@bottle.get('/labels')
def issues():
  return _html(title='Labels', react='labels')
  
@bottle.get('/issues/new')
def issues_new():
  return _html(title='New Issue', react='issues_new')
  
@bottle.get('/issues/<issue_id>.json')
def issue_json(issue_id):
  issue = idx[issue_id]
  return issue.as_dict()
  
@bottle.get('/users/<user_id>.json')
def user_json(user_id):
  user = idx[user_id]
  return user.as_dict()
  
@bottle.get('/issues/<issue_id>/comments.json')
def comments_json(issue_id):
  issue = idx[issue_id]
  return {
    'comments': [comment.as_dict() for comment in idx.get_comments(issue.id)],
  }
  
@bottle.get('/issues/<issue_id>')
def issue(issue_id):
  issue = idx[issue_id]
  if not issue:
    bottle.abort(404)
  if isinstance(issue, index.Comment):
    return bottle.redirect('/issues/%s' % issue.get_issue().short_id())
  return _html(title=issue.title, react='issue')
  
@bottle.get('/users/<user_id>')
def user(user_id):
  user = idx[user_id]
  if not user:
    bottle.abort(404)
  return _html(title=user.name, react='user')
  
@bottle.get('/account.json')
def account_json():
  return idx.account.as_dict()

@bottle.post('/upload')
def upload():
  data = bottle.request.body.read()
  asset = idx.save_asset(data, bottle.request.headers['Content-Type'])
  return asset.as_dict()
  
@bottle.get('/assets/<asset_id>')
def asset(asset_id):
  asset_id = asset_id.split('.')[0]
  asset = idx[asset_id]
  bottle.response.headers['Content-Type'] = asset.mime_type
  return asset.read()
  
  
@bottle.post('/issues/new')
def issues_new():
  issue = idx.new_issue()
  issue.title = bottle.request.forms['title']
  issue.save()
  if bottle.request.forms['comment']:
    comment = issue.new_comment()
    comment.text = bottle.request.forms['comment']
    comment.save()
  return bottle.redirect('/issues/%s' % issue.short_id())
  
@bottle.post('/reply-to/<item_id>')
def replay(item_id):
  item = idx[item_id]
  if 'comment' in bottle.request.forms and bottle.request.forms['comment']:
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
  if 'add_label' in bottle.request.forms:
    comment = item.new_comment()
    comment.kind = 'added_label'
    comment.label = bottle.request.forms['add_label']
    comment.save()
  if 'remove_label' in bottle.request.forms:
    comment = item.new_comment()
    comment.kind = 'removed_label'
    comment.label = bottle.request.forms['remove_label']
    comment.save()
  return 'ok'

@bottle.post('/update/<item_id>')
def update(item_id):
  item = idx[item_id]
  changed = False
  if not item :
    item = idx.create(bottle.request.forms['__class__'])
    changed = True
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
  
@bottle.get('/labels.json')
def labels_json():
  labels = [label.as_dict() for label in idx.labels()]
  if bottle.request.GET.get('new'):
    d = idx.new_label().as_dict()
    d['editing'] = True
    labels.append(d)
  return {
    'labels': labels,
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


