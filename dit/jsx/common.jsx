
function gid() {
  return 'gid' + Math.floor( Math.random()*1000000)
}


var Frame = React.createClass({
  getInitialState: function() {
    DitFrame = this;
    return {dirty_fns:[]};
  },
  componentDidMount: function() {
    this.load()
  },
  load: function() {
    $.get('/status.json', function(data) {
      this.setState(data)
      mdlUpgradeDom();
    }.bind(this));
  },
  revert: function() {
    $.post('/repo/revert/*', function(data) {
      location.reload();
    }.bind(this));
  },
  commit: function() {
    if (confirm("Are you sure you want to commit these "+ this.state.dirty_fns.length +" files?")) {
      $.post('/repo/commit/*', function(data) {
        location.reload();
      }.bind(this));
    }
  },
  render: function() {
    var repo_icon;
    if (this.state.dirty_fns.length) {
      repo_icon = (
        <i className="material-icons mdl-badge" style={{cursor:'pointer'}} data-badge={this.state.dirty_fns.length} id="dirty-menu">announcement</i>
      );
    } else {
      repo_icon = (
        <i className="material-icons mdl-badge" style={{cursor:'pointer', marginRight:'24px'}} id="dirty-menu">announcement</i>
      );
    }
    return (
      <div>
        <div className="mdl-layout mdl-js-layout mdl-layout--fixed-drawer
                    mdl-layout--fixed-header">
          <header className="mdl-layout__header">
            <div className="mdl-layout__header-row">
              <div className="mdl-layout-spacer"></div>
              {repo_icon}
              <ul className="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect"
                  htmlFor="dirty-menu">
                <li onClick={this.commit} className="mdl-menu__item" disabled={this.state.dirty_fns.length==0}>
                  Commit {this.state.dirty_fns.length} Updates
                </li>
                <li onClick={this.revert} disabled={this.state.dirty_fns.length==0} className="mdl-menu__item">Revert All Changes</li>
              </ul>              
              <a href='/search' style={{color:'white'}}>
                <i className="material-icons">search</i>
              </a>
            </div>
          </header>
          <div className="mdl-layout__drawer">
            <span className="mdl-layout-title">D.I.T.</span>
            <nav className="mdl-navigation">
              <a className="mdl-navigation__link" href="/">Home</a>
              <a className="mdl-navigation__link" href="/issues">Issues</a>
              <a className="mdl-navigation__link" href="/labels">Labels</a>
              <a className="mdl-navigation__link" href="/users">Users</a>
              <a className="mdl-navigation__link" href="/search">Search</a>
            </nav>
          </div>
          <main className="mdl-layout__content">
            <div className="page-content">
              {this.props.children}
            </div>
          </main>
        </div>
      </div>
    );
  },
  componentDidUpdate: function() {
    componentHandler.upgradeDom();
  },
});


var AuthorSig = React.createClass({
  render: function() {
    return (
        <span>
          -- <User data={this.props.author}/>
        </span>
    );
  }
});


var NewCommentForm = React.createClass({
  getInitialState: function() {
    return {text: '', editing: false, id:this.props.reply_to ? 'reply-to-'+this.props.reply_to : gid()};
  },
  handleFocus: function() {
    this.state.editing = true
    this.setState(this.state)
  },
  onChange: function() {
    this.setState({text:$(this.refs.textarea.getDOMNode()).val()})
  },
  handleBlur: function() {
    if (!this.state.text) {
      this.state.editing = false
      this.setState(this.state)
      if (this.props.onHide) {
        this.props.onHide()
      }
    }
  },
  componentDidMount: function() {
    mdlUpgradeDom();
    $(this.refs.textarea.getDOMNode()).textcomplete([
        {
          match: /\B@(\w{1,})$/,
          search: function (term, callback) {
            $.getJSON('/search.json', {kind:'User,Issue', q:term}, function(data) {
              callback($.map(data['items'], function (item) {
                  return '@'+item['slug'];
              }));
            });
          },
          index: 1,
          replace: function (word) {
            return word + ' ';
          }
        }
    ]);
  },
  componentDidUpdate: function(prevProps, prevState) {
    mdlUpgradeDom();
  },
  onPaste: function(e) {
    e.preventDefault();
    var items = (event.clipboardData || event.originalEvent.clipboardData).items;
    var blob;
    for (var i=0; i<items.length; ++i) {
      blob = items[i].getAsFile()
      if (blob!=null) break;
    }
    var reader = new FileReader();
    reader.onload = function(event){
      var mimeType = event.target.result.split(",")[0].split(":")[1].split(";")[0];
      $.ajax({
        url: '/upload',
        type: 'POST',
        contentType: mimeType,
        data: blob,
        processData: false,
        success: function(data) {
          var node = this.refs.textarea.getDOMNode()
          var position = node.selectionEnd
          var pre = node.value.substring(0,position) + '![image](' + data.url + ')'
          var post = node.value.substring(position)
          $(node).val(pre + post)
          node.selectionStart = node.selectionEnd = pre.length
          this.setState({text:pre + post})
        }.bind(this)
      });
    }.bind(this)
    reader.readAsDataURL(blob);
  },
  save: function(action) {
    data = {
      comment: $(this.refs.textarea.getDOMNode()).val()
    }
    data[action] = action
    $.post('/reply-to/'+this.props.reply_to, data, function() {
      this.props.reload()
      this.setState({editing: false, text:''})
      $(this.refs.textarea.getDOMNode()).val('')
      if (this.props.onHide) {
        this.props.onHide()
      }
    }.bind(this))
  },
  render: function() {
    var closeButton = this.props.closeButton ? (
      <button onClick={function() {this.save('close')}.bind(this)} className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" style={{marginRight:'1em'}}>
        Close Issue
      </button>
    ) : <span/>
    var reopenButton = this.props.reopenButton ? (
      <button onClick={function() {this.save('reopen')}.bind(this)} className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" style={{marginRight:'1em'}}>
        Reopen Issue
      </button>
    ) : <span/>
    var commentButton = this.state.editing ? (
      <button onClick={function() {this.save('add_comment')}.bind(this)} className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" style={{marginRight:'1em'}}>
        {this.props.button || 'Add Comment'}
      </button>
    ) : <span/>
    var line_numbers = this.state.text.split(/\r*\n/).length;
    var editor_size = Math.min(Math.max(line_numbers+1, 4), 20)
    return (
      <div>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <textarea className="mdl-textfield__input" type="text" rows={this.state.editing ? editor_size : 1} name='comment' ref="textarea" onFocus={this.handleFocus} onBlur={this.handleBlur} onChange={this.onChange} onPaste={this.onPaste}></textarea>
            <label className="mdl-textfield__label">{this.props.placeholder || 'Add a comment...'}</label>
          </div>
        </div>
        <div style={{paddingLeft:'2em'}}>
          {closeButton}
          {reopenButton}
          {commentButton}
        </div>
      </div>
    );
  }
});

var CommentList = React.createClass({
  getInitialState: function() {
    if (this.props.comments) {
      return {comments: this.props.comments};
    }
    return {comments: []};
  },
  componentDidMount: function() {
    this.doLoad()
  },
  doLoad: function() {
    if (this.props.src) {
      $.getJSON(this.props.src, function( data ) {
        this.setState(data);
      }.bind(this));
    }
  },
  componentDidUpdate: function(prevProps, prevState) {
    if (prevProps.src != this.props.src) {
      this.doLoad();
      mdlUpgradeDom();
    }
    if (prevProps.comments != this.props.comments) {
      this.setState({comments:this.props.comments});
      mdlUpgradeDom();
    }
  },
  render: function() {
    var reload = this.doLoad;
    if (this.props && this.props.reload) {
      reload = this.props.reload;
    }
    var nodes = this.state.comments.map(function (comment) {
      return (
        <Comment issue={this.props.issue} data={comment} reload={reload} key={'comment_'+comment.id}/>
      );
    }.bind(this));
    return (
      <div className='comment-list'>
        {nodes}
      </div>
    );
  },
});


var RevControl = React.createClass({
  commit: function(e) {
    if (confirm("Are you sure you want to commit this change?")) {
      $.post('/repo/commit/'+this.props.id, function(data) {
        this.props.reload();
      }.bind(this));
    }
    e.preventDefault();
  },
  revert: function(e) {
    if (confirm("Are you sure you want to revert this change?")) {
      $.post('/repo/revert/'+this.props.id, function(data) {
        this.props.reload();
      }.bind(this));
    }
    e.preventDefault();
  },
  render: function() {
    var icon_style = {fontSize:'12pt', verticalAlign:this.props.intext ? 'text-bottom' : ''};
    return this.props.dirty ? (
      <span style={{marginLeft:'.5em'}}>
        <a href='' onClick={this.revert}>
          <i className="material-icons" title='Revert' style={icon_style}>undo</i>
        </a>
        <a href='' onClick={this.commit}>
          <i className="material-icons" title='Commit' style={icon_style}>redo</i>
        </a>
      </span>
    ) : <span/>;
  },
});


var Comment = React.createClass({
  getInitialState: function() {
    return {editing: false, replying: false, items:{}};
  },
  componentDidUpdate: function(prevProps, prevState) {
    mdlUpgradeDom();
  },
  componentDidMount: function() {
    var ids = []
    this.props.data.text.replace(/\B@[\w-]+/g, function(w,m) {
      ids.push(w.substring(1))
    })
    if (ids.length) {
      $.getJSON('/items-by-id.json', {ids:ids.join(',')}, function(data) {
        this.setState({items:data})
        mdlUpgradeDom();
      }.bind(this))
    }
    mdlUpgradeDom();
  },
  handleClick: function(e) {
    this.state.replying = !this.state.replying
    this.setState(this.state)
    e.preventDefault();
  },
  handleHide: function() {
    this.state.replying = false
    this.setState(this.state)
  },
  show_history: function(e) {
    alert('Show history.');
    e.preventDefault();
  },
  edit: function(e) {
    this.state.editing = !this.state.editing
    this.setState(this.state)
    e.preventDefault();
  },
  save: function(e) {
    var text = $('#'+this.props.data.id+'-comment-edit-textarea').val();
    $.post('/update/'+this.props.data.id, {text:text}, function() {
      this.state.editing = !this.state.editing
      this.setState(this.state)
      this.props.reload();
    }.bind(this));
    e.preventDefault();
  },
  render: function() {
    if (this.props.data.kind) {
      var desc = <span>What happened here?</span>
      if (this.props.data.kind=='resolved') {
        desc = <span style={{color:'red'}}>Closed</span>
      } else
      if (this.props.data.kind=='reopened') {
        desc = <span style={{color:'green'}}>Reopened</span>
      } else
      if (this.props.data.kind=='added_label') {
        desc = <span>Added <Label data={this.props.data.label}/></span>
      } else
      if (this.props.data.kind=='removed_label') {
        desc = <span>Removed <Label data={this.props.data.label}/></span>
      } else
      if (this.props.data.kind=='assigned' || this.props.data.kind=='unassigned') {
        var participant = this.props.data.assignee.id==this.props.data.author.id ? "him/herself" : <User data={this.props.issue.participants[this.props.data.assignee]} />
        return (
          <div>
            <User data={this.props.data.author} /> {this.props.data.kind} {participant} at {this.props.data.created_at}
            <RevControl id={this.props.data.id} reload={this.props.reload} dirty={this.props.data.dirty} intext={true}/>
          </div>
        );
      }
      return (
        <div>
          {desc}
          &nbsp;
          <AuthorSig author={this.props.data.author} /> at {this.props.data.created_at}
          <RevControl id={this.props.data.id} reload={this.props.reload} dirty={this.props.data.dirty} intext={true}/>
        </div>
      );
    }
    var author = '';
    if (this.props.data.author) {
      author = (
        <div style={{marginTop:'-.3em'}}>
          <AuthorSig author={this.props.data.author} /> at {this.props.data.created_at}
          <a href='' onClick={this.handleClick}>
            <i className="material-icons" style={{marginLeft:'.5em', fontSize:'12pt', verticalAlign:'text-bottom'}}>reply</i>
          </a>
        </div>
      );
    }
    var rawMarkup = marked(this.props.data.text.toString(), {sanitize: true});
    rawMarkup = rawMarkup.replace(/\B@[\w-]+/g, function(w,m) {
      var id = w.substring(1);
      if (this.state.items[id]) {
        return React.renderToStaticMarkup(<Item data={this.state.items[id]}/>);
      } else {
        return w;
      }
    }.bind(this))
    var replybox = this.state.replying ? (
        <div style={{marginBottom:'1em'}}>
          <NewCommentForm placeholder="Reply..." reload={this.props.reload} button='Reply' reply_to={this.props.data.id} onHide={this.handleHide}/>
        </div>
    ) : '';
    return (
      <div>
        <div className="mdl-card mdl-shadow--2dp demo-card-wide" 
            style={{minHeight:"1px", width:"auto", 'margin':'1em 0em', display: !this.state.editing ? 'block' : 'none'}} 
            key={this.props.data.id}>
          <div className="mdl-card__supporting-text" style={{width:'auto'}}>
            <div style={{float:'right'}}>
              <RevControl id={this.props.data.id} reload={this.props.reload} dirty={this.props.data.dirty} intext={false}/>
              <a href='' onClick={this.show_history}>
                <i className="material-icons" style={{fontSize:'12pt'}}>history</i>
              </a>
              <a href='' onClick={this.edit}>
                <i className="material-icons" style={{fontSize:'12pt'}}>edit</i>
              </a>
            </div>
            <span dangerouslySetInnerHTML={{__html: rawMarkup}} />
            {author}
          </div>
        </div>
        <div className="mdl-card mdl-shadow--2dp demo-card-wide" 
            style={{minHeight:"1px", width:"auto", 'margin':'1em 0em', display: this.state.editing ? 'block' : 'none'}} 
            key={this.props.data.id+'editing'}>
          <div className="mdl-card__supporting-text" style={{width:'auto'}}>
            <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
              <textarea className="mdl-textfield__input" type="text" rows={4} 
                  id={this.props.data.id+'-comment-edit-textarea'} 
                  defaultValue={this.props.data.text}></textarea>
              <label className="mdl-textfield__label">Details...</label>
            </div>
            <div style={{marginTop:'1em'}}>
              <button className="mdl-button mdl-js-button mdl-button--raised" onClick={this.save}>
                Save
              </button>
              <button className="mdl-button mdl-js-button mdl-js-ripple-effect" onClick={this.edit} style={{marginLeft:'1em'}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
        {replybox}
        <CommentList comments={this.props.data.comments} reload={this.props.reload} />
      </div>
    );
  }
});


var Item = React.createClass({
  render: function() {
    if (this.props.data.__class__=='User') {
      return <User data={this.props.data}/>
    }
    if (this.props.data.__class__=='Issue') {
      return <Issue data={this.props.data}/>
    }
    return (
      <span>
        Unknown:{this.props.data.__class__}
      </span>
    )
  },
});


var User = React.createClass({
  render: function() {
    if (!this.props.data) {
      return <span>Someone</span>
    }
    return (
      <a href={'/users/'+this.props.data.slug}>
        {this.props.data.name || 'Someone'}
      </a>
    )
  },
});


var Issue = React.createClass({
  render: function() {
    return (
      <a href={'/issues/'+this.props.data.slug}>
        {this.props.data.title}
      </a>
    )
  },
});


var IssueResolvedState = React.createClass({
  render: function() {
    var resolved_state = <i className="material-icons" style={{fontSize:'12pt', color:this.props.resolved>.5 ? 'red' : 'green', verticalAlign:'text-bottom', marginLeft:'.5em'}}>error_outline</i>;
    var resolved_state_detail = this.props.resolved && this.props.resolved<1 ? (
      <span>
        {Math.round(this.props.resolved*100)}%
      </span>
    ) : <span/>
    return (
      <span>
        {resolved_state} {resolved_state_detail}
      </span>
    )
  },
});


var Label = React.createClass({
  render: function() {
    var data = this.props.data ? this.props.data : {}
    var consensus = this.props.weight==null || this.props.weight>.5;
    var bg_color = consensus && data.bg_color || '#eeeeee'
    var fg_color = consensus && data.fg_color || '#000000'
    var name = this.props.data ? this.props.data.name : 'Unknown Label'
    var quotedName = name
    if (quotedName.indexOf(' ')>-1) {
      quotedName = '"' + (name.replace('"','\"')) + '"'
    }
    var weight = this.props.weight && this.props.weight<1 ? (
      <span>
        ({Math.round(this.props.weight*100)}%)
      </span>
    ) : <span/>
    var url = '/search?q=' + encodeURIComponent("label:" + quotedName)
    return (
      <a href={url} style={{padding:'.1em .5em', margin:'.4em .2em', backgroundColor:bg_color, color:fg_color, textDecoration:'none', display:this.props.block ? 'block' : 'inline'}} className='mdl-shadow--2dp'>
        {name || '---'} {weight}
      </a>
    );
  },
});



function mdlUpgradeDom() {
  setTimeout(function() {
    componentHandler.upgradeDom();
  }, 100);
}
mdlUpgradeDom();


