#!/usr/bin/env python

from distutils.core import setup

setup(name='distributed-issue-tracker',
      version='0.1',
      description='Distributed Issue Tracker',
      author='Derek Anderson',
      author_email='public@kered.org',
      url='https://github.com/keredson/distributed-issue-tracker',
      packages=['dit'],
      requires=['bottle','bleach','markdown',],
     )

