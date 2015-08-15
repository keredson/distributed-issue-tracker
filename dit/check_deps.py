import os

try:
  import bottle
except Exception as e:
  print e.message
  print 'installing...'
  os.system('sudo pip install bottle')
  import bottle
  
try:
  import yaml
except Exception as e:
  print e.message
  print 'installing...'
  os.system('sudo pip install pyyaml')
  import yaml
  
try:
  import dateutil
except Exception as e:
  print e.message
  print 'installing...'
  os.system('sudo pip install python-dateutil')
  import dateutil
  
try:
  import patricia
except Exception as e:
  print e.message
  print 'installing...'
  os.system('sudo pip install patricia-trie')
  import patricia
  
try:
  import git
except Exception as e:
  print e.message
  print 'installing...'
  os.system('sudo pip install gitpython')
  import git
  

