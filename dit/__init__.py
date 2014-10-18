import bottle, json, os, uuid

MOD_PATH = os.path.dirname(__file__)
STATIC_PATH = os.path.join(MOD_PATH,'static')
VIEWS_PATH = os.path.join(MOD_PATH,'views')
#bottle.TEMPLATE_PATH.append(os.path.join(MOD_PATH,'views'))

import dit.index

index = dit.index.Index()

@bottle.route('/static/<filepath:path>')
def server_static(filepath):
  return bottle.static_file(filepath, root=STATIC_PATH)

@bottle.route('/')
def home():
  return bottle.redirect('/issues')

@bottle.route('/issues')
def issues():
  return render('issues.html')

@bottle.route('/json/issues')
def json_issues():
  return {
    'issues':index.issues(),
  }

@bottle.route('/json/repo')
def json_repo():
  return index.repo()

@bottle.route('/issue/<uid>')
def issue(uid):
  if uid=='new':
    return render('new_issue.html')
  else:
    uid = uuid.UUID(uid)
    issue = index.issue(uid)
    return render('issue.html', issue=json.dumps(issue))

@bottle.post('/issue/save')
def issue_save():
  issue = bottle.request.json
  issue = index.save_issue(issue)
  return issue

@bottle.post('/comment/save')
def comment_save():
  comment = bottle.request.json
  return index.save_comment(comment)

@bottle.post('/repo/revert')
def repo_revert():
  o = bottle.request.json
  return index.revert(o)

def render(fn, **kwargs):
  with open(os.path.join(VIEWS_PATH,'__base__.html'),'r') as bf:
    base = '\n'.join(bf.readlines())
    
    with open(os.path.join(VIEWS_PATH,fn),'r') as f:
      data = '\n'.join(f.readlines())
      for k,v in kwargs.items():
        print k, k.__class__, '##%s##'%k
        data = data.replace('##%s##'%k,str(v))
      return base.replace('##__content__##',data)
  

bottle.run(host='localhost', port=8080, debug=True)

