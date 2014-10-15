import bleach, git, json, markdown, os, uuid

bleach.ALLOWED_TAGS.append('p')

class Index(object):

  def __init__(self):
    self.root = find_root(os.getcwd())
  
  def repo(self):
    project_dir = os.path.dirname(self.root)
    repo = git.Repo(project_dir)
    return {
      'project_dir': project_dir,
      'project': os.path.split(project_dir)[-1],
      'origin': repo.remotes.origin.url if len(repo.remotes) else '(no origin)',
    }
    
  def issues(self):
    return list(*self._issues())
    
  def _issues(self):
    issues_dir = os.path.join(self.root,'issues')
    for fn in os.listdir(issues_dir):
      issue_path = os.path.join(issues_dir,fn)
      if os.path.isdir(issue_path):
        with open(os.path.join(issue_path,'issue.json'),'r') as f:
          issue = json.load(f)
          issue['_description'] = bleach.clean(markdown.markdown(issue['description']))
          yield issue, issue_path
  
  def issue(self, uid):
    uid = str(uid)
    for issue, issue_path in self._issues():
      if issue['id'] == uid:
        return issue
  
  def _issue_path(self, uid):
    uid = str(uid)
    for issue, issue_path in self._issues():
      if issue['id'] == uid:
        return issue_path
  
  def save_issue(self, issue):
    uuid.UUID(issue['id'])
    fn = os.path.join(self._issue_path(issue['id']),'issue.json')
    with open(fn,'w') as f:
      issue = issue.copy()
      for k in issue.keys():
        if k.startswith('_'):
          del issue[k]
      print 'write',issue, 'to', fn
      json.dump(issue,f, sort_keys=True, indent=4)


def find_root(path):
  candidate = os.path.join(path,'.dit')
  if os.path.isdir(candidate):
    return candidate
  if path=='/': return None
  return os.path.dirname(path)
    
    


