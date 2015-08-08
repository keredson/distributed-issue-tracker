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
    'comments': [comment.as_dict() for comment in issue.comments],
  }
  
@bottle.get('/issues/<issue_id>')
def issue(issue_id):
  issue = idx[issue_id]
  return _html(title=issue.title, react='issue')
  
@bottle.post('/issues/new')
def issues_new():
  issue = idx.new_issue()
  issue.title = bottle.request.forms['title']
  issue.save()
  comment = issue.new_comment()
  comment.text = bottle.request.forms['comment']
  comment.save()
  return bottle.redirect('/issues/%s' % issue.short_id())
  
@bottle.post('/issues/<issue_id>/new-comment')
def comment_new(issue_id):
  issue = idx[issue_id]
  comment = issue.new_comment()
  comment.text = bottle.request.forms['comment']
  comment.save()
  return bottle.redirect('/issues/%s' % issue.short_id())
  
@bottle.get('/issues.json')
def issues_json():
  return {
    'issues': [issue.as_dict() for issue in idx.issues()],
  }
  
@bottle.get('/jsx/<path>')
def jsx(path):
  with open(os.path.join(BASE, 'jsx', path)) as f:
    return f.read()
  
@bottle.get('/css/<path>')
def static(path):
  bottle.response.content_type = 'text/css'
  with open(os.path.join(BASE, 'static', path)) as f:
    return f.read()
  

def _html(**kwargs):
  with open(os.path.join(BASE, 'templates', 'index.html')) as f:
    return bottle.template(f.read(), **kwargs)


if __name__=='__main__':
  bottle.run(host='localhost', port=4920)


