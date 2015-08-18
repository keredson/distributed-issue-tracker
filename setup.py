#!/usr/bin/env python

from distutils.core import setup

setup(name='distributed-issue-tracker',
      version='0.1',
      description='Distributed Issue Tracker',
      author='Derek Anderson',
      author_email='public@kered.org',
      url='https://github.com/keredson/distributed-issue-tracker',
      packages=['dit'],
      requires=['bottle','bleach','markdown','git','yaml','dateutil','patricia'],
      package_dir={'dit': 'dit'},
      package_data={'dit': ['templates/*.html','jsx/*.jsx','static/*.css','static/*.js','static/*.ttf','static/*.woff2']},
     )

