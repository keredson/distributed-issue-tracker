import sys

if __name__=='__main__':
  if 'serve' in sys.argv:
    import dit.server
    dit.server.serve()
  else:
    print 'Usage: python -m dit serve'

