import os, platform, sys

REQUIRED_DEPS = ['bottle','bleach','markdown',]
OPTIONAL_DEPS = ['git']

UBUNTU_PACKAGE_NAMES = {
  'bottle': 'python-bottle',
  'markdown': 'python-markdown',
#  'bleach': 'python-bleach', # broken in ubuntu
  'git': 'python-git',
}

def check_bleach():
  try:
    import bleach
  except:
    return
  try:
    bleach.clean('derek')
    return
  except:
    pass
  print 
  print 'Your copy of the Ubuntu package python-bleach is broken.'
  print 'https://bugs.launchpad.net/ubuntu/+source/python-bleach/+bug/1318324'
  print 
  answer = raw_input("Would you like to remove it and install a working version from pip? [y/N] ")
  if answer.strip().lower()=='y':
    cmd = 'sudo apt-get remove python-bleach'
    print '$', cmd
    os.system(cmd)
    cmd = 'sudo pip install bleach'
    print '$', cmd
    os.system(cmd)
    reload(bleach)
  else:
    print 'Exiting...'
    sys.exit(1)
  

def check_deps(desc, deps):
  deps = set(deps)
  for dep in list(deps):
    try:
      __import__(dep)
      deps.remove(dep)
    except:
      pass
  if len(deps)==0: return True
  print
  print "You're missing the following %i %s Python package%s." % (len(deps), desc, '' if len(deps)==1 else 's',)
  print ', '.join(deps)
  print 
  if platform.linux_distribution()[0]=='Ubuntu':
    answer = raw_input("Do you wish to install them now? [y/N] ")
    if answer.strip().lower()=='y':
      for dep in deps:
        if dep in UBUNTU_PACKAGE_NAMES:
          cmd = 'sudo apt-get install '+ UBUNTU_PACKAGE_NAMES[dep]
        else:
          cmd = 'sudo pip install '+ dep
        print '$', cmd
        os.system(cmd)
      return True
    else:
      return False
  else:
    return False
    
  
check_bleach()

success = check_deps('REQUIRED', REQUIRED_DEPS)
if not success: sys.exit(1)

success = check_deps('OPTIONAL', OPTIONAL_DEPS)

