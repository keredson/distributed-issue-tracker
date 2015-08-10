
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
              <div className="mdl-textfield mdl-js-textfield mdl-textfield--expandable
                          mdl-textfield--floating-label mdl-textfield--align-right">
                <label className="mdl-button mdl-js-button mdl-button--icon"
                       for="fixed-header-drawer-exp">
                  <i className="material-icons">search</i>
                </label>
                <div className="mdl-textfield__expandable-holder">
                  <input className="mdl-textfield__input" type="text" name="sample"
                         id="fixed-header-drawer-exp" />
                </div>
              </div>
            </div>
          </header>
          <div className="mdl-layout__drawer">
            <span className="mdl-layout-title">D.I.T.</span>
            <nav className="mdl-navigation">
              <a className="mdl-navigation__link" href="/">Home</a>
              <a className="mdl-navigation__link" href="/issues">Issues</a>
              <a className="mdl-navigation__link" href="/issues/new">New Issue</a>
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

var IssueList = React.createClass({
  getInitialState: function() {
    return {issues: []};
  },
  componentDidMount: function() {
    $.getJSON(this.props.url, function( data ) {
      this.setState(data);
    }.bind(this));
  },
  render: function() {
    console.log(this)
    var issueNodes = this.state.issues.map(function (issue) {
      return (
        <IssueLI data={issue}/>
      );
    });
    return (
      <div>
        <table className="mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp" width='100%'>
          <thead>
            <tr>
              <th className="mdl-data-table__cell--non-numeric">Id</th>
              <th className="mdl-data-table__cell--non-numeric" width='100%'>Issue</th>
              <th className="mdl-data-table__cell--non-numeric"> </th>
              <th className="mdl-data-table__cell--non-numeric">
                <i className="material-icons" style={{fontSize:'12pt', verticalAlign:'text-bottom'}}>error_outline</i>
              </th>
            </tr>
          </thead>
          <tbody>
            {issueNodes}
          </tbody>
        </table>
        <div style={{marginTop:'1em', display:this.state.issues.length ? 'none' : 'block'}}>
          No issues...
        </div>
      </div>
    );
  },
});

var IssueLI = React.createClass({
  render: function() {
    return (
      <tr>
        <td className="mdl-data-table__cell--non-numeric">
          <a href={this.props.data.url}>{this.props.data.short_id}</a>
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          {this.props.data.title}
        </td>
        <td style={{color: this.props.data.comment_count ? '' : '#ddd'}}>
          {this.props.data.comment_count}
          <i className="material-icons" style={{marginLeft:'.2em', fontSize:'10pt', verticalAlign:'text-bottom'}}>comment</i>
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          <i className="material-icons" style={{fontSize:'12pt', color:this.props.data.resolved ? 'red' : 'green', verticalAlign:'text-bottom'}}>error_outline</i>
        </td>
      </tr>
    );
  }
});

var Issue = React.createClass({
  getInitialState: function() {
    return {'title':''};
  },
  componentDidMount: function() {
    $.getJSON(this.props.src, function( data ) {
      this.setState(data);
    }.bind(this));
  },
  render: function() {
    var author = '';
    if (this.state.author) {
      style = {fontSize:'12pt', color:this.state.resolved ? 'red' : 'green', verticalAlign:'text-bottom', marginLeft:'.5em'};
      author = (
        <div style={{'margin-top':'-24px'}}>
          <AuthorSig author={this.state.author} /> at {this.state.created_at}
          <i className="material-icons" style={style}>error_outline</i>
        </div>
      );
    }
    return (
      <div>
        <h2>
          {this.state.title}
          <a href=''><i className="material-icons" style={{marginLeft:'.5em'}}>edit</i></a>
        </h2>
        {author}
        <CommentList src={this.state.comments_url} />
        <NewCommentForm reply_to={this.state.id} closeButton={!this.state.resolved} reopenButton={this.state.resolved} />
      </div>
    );
  }
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

var NewIssueForm = React.createClass({
  getInitialState: function() {
    return {title: '', id: ''};
  },
  render: function() {
    return (
      <form method='post'>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <input className="mdl-textfield__input" type="text" id="title" name='title' defaultValue={this.state.title} />
            <label className="mdl-textfield__label" for="title">Title</label>
          </div>
        </div>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <textarea className="mdl-textfield__input" type="text" rows="10" name='comment' id="sample5" ></textarea>
            <label className="mdl-textfield__label" for="sample5">Details...</label>
          </div>
        </div>
        <div>
          <button className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent">
            {this.state.id ? "Save" : "Create"}
          </button>
        </div>
      </form>
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
    var nodes = this.state.comments.map(function (comment) {
      return (
        <Comment data={comment}/>
      );
    });
    return (
      <div style={{paddingLeft:'1em'}}>
        {nodes}
      </div>
    );
  },
});

var Comment = React.createClass({
  getInitialState: function() {
    return {replying: false};
  },
  handleClick: function() {
    this.state.replying = !this.state.replying
    this.setState(this.state)
    return false
  },
  handleHide: function() {
    this.state.replying = false
    this.setState(this.state)
  },
  commit: function() {
    alert('This needs to be committed.');
    return false
  },
  render: function() {
    if (this.props.data.kind) {
      return (
        <div>
          <span style={{display:this.props.data.kind=='resolved' ? 'inline' : 'none', color:'red'}}>Closed</span>
          <span style={{display:this.props.data.kind=='reopened' ? 'inline' : 'none', color:'green'}}>Reopened</span>
          &nbsp;
          <AuthorSig author={this.props.data.author} /> at {this.props.data.created_at}
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
            style={{minHeight:"1px", width:"auto", 'margin':'1em 0em'}} 
            key={this.props.data.id}>
          <div className="mdl-card__supporting-text" style={{width:'auto'}}>
            <div style={{float:'right'}}>
              <a href='' onClick={this.commit} style={{display:this.props.data.dirty ? 'inline' : 'none'}}>
                <i className="material-icons" style={{fontSize:'12pt'}}>warning</i>
              </a>
              <a href='' onClick={this.commit}>
                <i className="material-icons" style={{width:'16px', fontSize:'12pt'}}>change history</i>
              </a>
            </div>
            <span dangerouslySetInnerHTML={{__html: rawMarkup}} />
            {author}
          </div>
        </div>
        <div style={{display: this.state.replying ? 'block' : 'none'}}>
          <NewCommentForm placeholder="Reply..." button='Reply' reply_to={this.props.data.id} onHide={this.handleHide}/>
        </div>
        <CommentList comments={this.props.data.comments} />
      </div>
    );
  }
});

function mdlUpgradeDom() {
  setTimeout(function() {
    componentHandler.upgradeDom();
  }, 50);
}
mdlUpgradeDom();


