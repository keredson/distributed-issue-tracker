Distributed Issue Tracker
=========================

I wrote this issue tracker because of two major deficiencies I believe all existing issue trackers share.

1. Distributed version control systems are wonderful as everyone knows, but what use is their offline 
ability if you're still tied to your online issue tracking system?

2. Issue state is complicated.  The issue may be "closed" in `HEAD`, but is it fixed in every branch?
Most issue trackers either make no attempt to track this, or there is a list of "open in branch `X`, closed in branch `Y`" flags you need to manually set.  Similarly for every attribute of an issue.  This is painful and labor intensive, and so it's infrequently tracked even when the feature exists.

Both of these shortcomings can be easily resolved by ditching the traditional RDBMS backing and instead storing all issue
state directly in your version control system.

1. Because your issue database is embedded in your repo and the web server hosting it runs locally, you never have to worry
about an internet connection.  Horray for working on the plane!

2. When you make a commit you also commit the new/changed issues (and comments, labels, etc.) that that commit affects.
The changes that fix a bug are forever tied to the issue that tracks it, across branches, merges, etc.  If a merge hasn't 
been made into a branch, an issue will remain open in a branch.

For the overall look and feel of the app, if you're used to the excellent issue tracker GitHub provides you'll feel right at home!

Status
------

Currently only `git` repos are supported, but `hg` support is intended / planned.

DIT is in a `pre-aplha` stage currently.
I welcome anyone who wishes to contribute!

Install
-------

```bash
$ git clone https://github.com/keredson/distributed-issue-tracker.git
$ cd distributed-issue-tracker
$ sudo python setup.py install
```

Run
---

From any git repo you have lying around... 

```bash
$ python -m dit serve
Bottle v0.12.0 server starting up (using WSGIRefServer())...
Listening on http://localhost:4920/
Hit Ctrl-C to quit.
```

