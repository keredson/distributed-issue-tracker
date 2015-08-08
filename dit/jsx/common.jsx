var Frame = React.createClass({
  render: function() {
    return (
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
      <table className="mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp">
        <thead>
          <tr>
            <th className="mdl-data-table__cell--non-numeric">Issue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {issueNodes}
        </tbody>
      </table>
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
    return (
      <div>
        <h1>
          {this.state.title}
          <button className="mdl-button mdl-js-button mdl-js-ripple-effect" style={{'margin-left':'1em'}}>
            Edit
          </button>
        </h1>
        <CommentList src={this.state.comments_url} />
        <NewCommentForm issue_id={this.state.id} />
      </div>
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
    return {text: '', rows: 1};
  },
  handleFocus: function() {
    this.state.rows = 4
    this.setState(this.state)
  },
  handleBlur: function() {
    this.state.rows = 1
    this.setState(this.state)
  },
  render: function() {
    return (
      <form method='post' action={document.location + '/new-comment'}>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <textarea className="mdl-textfield__input" type="text" rows={this.state.rows} name='comment' id="sample5" onFocus={this.handleFocus} onBlur={this.handleBlur}></textarea>
            <label className="mdl-textfield__label" for="sample5">Add a comment...</label>
          </div>
        </div>
        <div>
          <button className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect">
            Add Comment
          </button>
        </div>
      </form>
    );
  }
});

var CommentList = React.createClass({
  getInitialState: function() {
    return {comments: []};
  },
  componentDidMount: function() {
    this.doLoad()
  },
  doLoad: function() {
    $.getJSON(this.props.src, function( data ) {
      this.setState(data);
    }.bind(this));
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
      <div>
        {nodes}
      </div>
    );
  },
});

var Comment = React.createClass({
  render: function() {
    return (
      <div className="mdl-card mdl-shadow--2dp demo-card-wide" style={{"min-height":"1px", width:"80%", margin:'1em'}}>
        <div className="mdl-card__supporting-text">
          {this.props.data.text}
        </div>
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


