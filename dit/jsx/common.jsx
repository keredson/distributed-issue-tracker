
function gid() {
  return 'gid' + Math.floor( Math.random()*1000000)
}


var Frame = React.createClass({
  render: function() {
    return (
      <div>
        <div className="mdl-layout mdl-js-layout mdl-layout--fixed-drawer
                    mdl-layout--fixed-header">
          <header className="mdl-layout__header">
            <div className="mdl-layout__header-row">
              <div className="mdl-layout-spacer"></div>
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


var Author = React.createClass({
  render: function() {
    var name = this.props.author ? this.props.author.name : null;
    return (
        <span>
          {name || 'Someone'}
        </span>
    );
  }
});


var AuthorSig = React.createClass({
  render: function() {
    return (
        <span>
          -- <Author author={this.props.author}/>
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
  handleBlur: function() {
    if (!$(this.refs.textarea.getDOMNode()).val()) {
      this.state.editing = false
      this.setState(this.state)
      if (this.props.onHide) {
        this.props.onHide()
      }
    }
  },
  componentDidMount: function() {
    mdlUpgradeDom();
  },
  componentDidUpdate: function(prevProps, prevState) {
    mdlUpgradeDom();
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
    return (
      <div>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <textarea className="mdl-textfield__input" type="text" rows={this.state.editing ? 4 : 1} name='comment' ref="textarea" onFocus={this.handleFocus} onBlur={this.handleBlur}></textarea>
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
        <Comment data={comment} reload={reload} key={'comment_'+comment.id}/>
      );
    });
    return (
      <div className='comment-list'>
        {nodes}
      </div>
    );
  },
});

var Comment = React.createClass({
  getInitialState: function() {
    return {editing: false, replying: false};
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
  commit: function() {
    alert('This needs to be committed.');
    e.preventDefault();
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
    var dirty = function(in_text) {
      return this.props.data.dirty ? (
        <a href='' onClick={this.commit}>
          <i className="material-icons" style={{fontSize:'12pt', verticalAlign:in_text ? 'text-bottom' : '', marginLeft:'.5em'}}>warning</i>
        </a>
      ) : '';
    }.bind(this);
    if (this.props.data.kind) {
      var desc = <span>Unknown comment action.</span>
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
      }
      
      return (
        <div>
          {desc}
          &nbsp;
          <AuthorSig author={this.props.data.author} /> at {this.props.data.created_at}
          {dirty(true)}
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
    console.log('this.props.reload', this.props.reload)
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
              {dirty(false)}
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


var Label = React.createClass({
  render: function() {
    var data = this.props.data ? this.props.data : {}
    bg_color = data.bg_color || '#eeeeee'
    fg_color = data.fg_color || '#000000'
    var name = this.props.data ? this.props.data.name : 'Unknown Label'
    var quotedName = name
    if (quotedName.indexOf(' ')>-1) {
      quotedName = '"' + (name.replace('"','\"')) + '"'
    }
    var url = '/search?q=' + encodeURIComponent("label:" + quotedName)
    return (
      <a href={url} style={{padding:'.1em .5em', margin:'.4em .2em', backgroundColor:bg_color, color:fg_color, textDecoration:'none', display:this.props.block ? 'block' : 'inline'}} className='mdl-shadow--2dp'>
        {name || '---'}
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


