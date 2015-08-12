
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


var AuthorSig = React.createClass({
  render: function() {
    return (
        <span>
          -- {this.props.author.name}
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
    if (!$('#'+this.state.id).val()) {
      this.state.editing = false
      this.setState(this.state)
      if (this.props.onHide) {
        this.props.onHide()
      }
    }
  },
  render: function() {
    return (
      <form method='post' action={'/reply-to/'+this.props.reply_to}>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <textarea className="mdl-textfield__input" type="text" rows={this.state.editing ? 4 : 1} name='comment' id={this.state.id} onFocus={this.handleFocus} onBlur={this.handleBlur}></textarea>
            <label className="mdl-textfield__label" for="sample5">{this.props.placeholder || 'Add a comment...'}</label>
          </div>
        </div>
        <div style={{paddingLeft:'2em;'}}>
          <button name='close' className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" style={{display: this.props.closeButton ? 'inline' : 'none', marginRight:'1em'}}>
            Close Issue
          </button>
          <button name='reopen' className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" style={{display: this.props.reopenButton ? 'inline' : 'none', marginRight:'1em'}}>
            Reopen Issue
          </button>
          <button className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" style={{display: this.state.editing ? 'inline' : 'none'}}>
            {this.props.button || 'Add Comment'}
          </button>
        </div>
      </form>
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
  },
  render: function() {
    var reload = this.doLoad;
    if (this.props && this.props.reload) {
      reload = this.props.reload;
    }
    var nodes = this.state.comments.map(function (comment) {
      return (
        <Comment data={comment} reload={reload}/>
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
  handleClick: function() {
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
  show_history: function() {
    alert('Show history.');
    e.preventDefault();
  },
  edit: function() {
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
      return (
        <div>
          <span style={{display:this.props.data.kind=='resolved' ? 'inline' : 'none', color:'red'}}>Closed</span>
          <span style={{display:this.props.data.kind=='reopened' ? 'inline' : 'none', color:'green'}}>Reopened</span>
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
        <div style={{display: this.state.replying ? 'block' : 'none'}}>
          <NewCommentForm placeholder="Reply..." button='Reply' reply_to={this.props.data.id} onHide={this.handleHide}/>
        </div>
        <CommentList comments={this.props.data.comments} reload={this.props.reload} />
      </div>
    );
  }
});


var Label = React.createClass({
  render: function() {
    return (
      <span style={{padding:'.1em .5em', backgroundColor:this.props.data.bg_color, color:this.props.data.fg_color}} className='mdl-shadow--2dp'>
        {this.props.data.name || '---'}
      </span>
    );
  },
});



function mdlUpgradeDom() {
  setTimeout(function() {
    componentHandler.upgradeDom();
  }, 50);
}
mdlUpgradeDom();


