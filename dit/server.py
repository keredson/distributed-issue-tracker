import collections, os

import check_deps

import bottle
import git

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
  
@bottle.get('/status.json')
def status_json():
  return idx.status()
  
@bottle.get('/items-by-id.json')
def items_json():
  items_by_id = {id:idx[id.split('-')[0]] for id in bottle.request.GET['ids'].split(',')}
  return {id:item.as_dict() if item else None for id,item in items_by_id.items()}
  
@bottle.get('/issues')
def issues():
  return _html(title='Issues', react='issues')
  
@bottle.get('/issues.json')
def issues_json():
  return {
    'issues': [issue.as_dict() for issue in idx.issues()],
  }
  
@bottle.get('/labels')
def issues():
  return _html(title='Labels', react='labels')
  
@bottle.get('/labels.json')
def labels_json():
  labels = [label.as_dict() for label in idx.labels()]
  issue_counts = collections.defaultdict(int)
  for comment in idx.all_comments():
    if not comment.label: continue
    issue_counts[comment.label] += 1
  if bottle.request.GET.get('new'):
    d = idx.new_label().as_dict()
    d['editing'] = True
    labels.append(d)
  return {
    'labels': labels,
    'issue_counts': issue_counts,
  }
  
@bottle.get('/users')
def users():
  return _html(title='Users', react='users')
  
@bottle.get('/users.json')
def users_json():
  users = [user.as_dict() for user in idx.users()]
  return {
    'users': users,
  }
  
@bottle.get('/issues/<issue_id>.json')
def issue_json(issue_id):
  issue = idx[issue_id]
  if not issue and issue_id=='new':
    if 'id' in bottle.request.GET:
      issue = idx[bottle.request.GET['id']]
      if not issue:
        issue = idx.new_issue()
        issue.id = bottle.request.GET['id']
    else:
      issue = idx.new_issue()
  return issue.as_dict()
  
@bottle.get('/issues/<issue_id>')
def issue(issue_id):
  issue = idx.new_issue() if issue_id=='new' else idx[issue_id]
  if not issue:
    bottle.abort(404)
  if isinstance(issue, index.Comment):
    return bottle.redirect('/issues/%s' % issue.get_issue().short_id())
  return _html(title=issue.title, react='issue')
  
@bottle.get('/users/<user_id>.json')
def user_json(user_id):
  user = idx[user_id]
  return user.as_dict()
  
@bottle.get('/users/<user_id>')
def user(user_id):
  user = idx[user_id]
  if not user:
    bottle.abort(404)
  return _html(title=user.name, react='user')
  
@bottle.get('/issues/<issue_id>/comments.json')
def comments_json(issue_id):
  issue = idx[issue_id]
  comments = [comment.as_dict() for comment in idx.get_comments(issue.id if issue else issue_id)]
  return {
    'comments': comments,
  }
  
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
  
  
@bottle.post('/reply-to/<item_id>')
def reply(item_id):
  item = idx[item_id]
  if not item and 'create' in bottle.request.forms:
    item = idx.new_issue()
    item.id = item_id
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
    comment.kind = 'labeled'
    comment.label = bottle.request.forms['add_label']
    comment.save()
  if 'remove_label' in bottle.request.forms:
    comment = item.new_comment()
    comment.kind = 'unlabeled'
    comment.label = bottle.request.forms['remove_label']
    comment.save()
  if 'assign' in bottle.request.forms:
    comment = item.new_comment()
    comment.kind = 'assigned'
    comment.assignee = bottle.request.forms.get('assignee') or idx.account.id
    comment.save()
  if 'unassign' in bottle.request.forms:
    comment = item.new_comment()
    comment.kind = 'unassigned'
    comment.assignee = bottle.request.forms.get('assignee') or idx.account.id
    comment.save()
  return 'ok'

@bottle.post('/update/<item_id>')
def update(item_id):
  item = idx[item_id]
  if not item and 'create' in bottle.request.forms:
    item = idx.new_issue()
    item.id = item_id
  changed = False
  if not item:
    item = idx.create(bottle.request.forms['__class__'])
    changed = True
  for k,v in bottle.request.forms.items():
    if (item.allow_update(k)):
      setattr(item,k,v)
      changed = True
  if changed:
    item.save()
  return 'ok'

@bottle.post('/repo/revert/<id>')
def repo_revert(id):
  if id=='*':
    idx.revert_all()
  else:
    idx.revert(id)
  return 'ok'
  
@bottle.post('/repo/commit/<id>')
def repo_commit_fn(id):
  if id=='*':
    idx.commit_all()
  else:
    idx.commit(id)
  return 'ok'

@bottle.error(404)
def error404(error):
  return _html(title='404', react='error')
  
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


def serve():
  bottle.run(host='localhost', port=4920)


