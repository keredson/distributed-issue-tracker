
var LabelController = React.createClass({
  getInitialState: function() {
    return {editing:false, labels:[], q:''};
  },
  componentDidMount: function() {
    $.getJSON('/labels.json', function( data ) {
      this.setState(data);
    }.bind(this));
    mdlUpgradeDom();
  },
  componentDidUpdate: function(prevProps, prevState) {
    setTimeout(function() {
      if (this.state.editing) {
        this.refs.search.getDOMNode().focus(); 
      }
    }.bind(this), 50);
  },
  updateSearch: function() {
    var q = $(this.refs.search.getDOMNode()).val().toLowerCase();
    this.setState({q:q})
  },
  edit: function(e) {
    this.setState({editing: !this.state.editing})
    e.preventDefault();
  },
  render: function() {
    var all_labels = this.state.labels.map(function (label) {
      if (label.name.toLowerCase().indexOf(this.state.q) == -1) {
        return <span />
      }
      return (
        <a href='' style={{textDecoration:'none'}}>
          <div style={{padding:'.1em .5em', margin:'.5em', backgroundColor:label.bg_color, color:label.fg_color}} className='mdl-shadow--2dp'>
            {label.name || '---'}
            <i className="material-icons" style={{fontSize:'11pt', verticalAlign:'middle', float:'right', clear:'right'}}>add</i>
          </div>
        </a>
      );
    }.bind(this));
    return (
      <div className="mdl-card mdl-shadow--2dp" style={{width:'100%', marginTop:'3em'}}>
        <div className="mdl-card__title">
          <h2 className="mdl-card__title-text">Labels</h2>
        </div>
        <div className="mdl-card__supporting-text" style={{width:'auto'}}>
          <div style={{marginTop:'-20px', display:this.state.editing ? 'block' : 'none'}}>
            <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{marginTop:'-20px'}}>
              <input className="mdl-textfield__input" type="text" id="sample1" onChange={this.updateSearch} ref='search'/>
              <label className="mdl-textfield__label" htmlFor="sample1">Search...</label>
            </div>
            {all_labels}
          </div>
        </div>
        <div className="mdl-card__menu">
          <button className="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect" onClick={this.edit}>
            <i className="material-icons">{this.state.editing ? 'clear' : 'add'}</i>
          </button>
        </div>
      </div>        
    )
  },
});

var Issue = React.createClass({
  getInitialState: function() {
    return {issue:{'title':''}, editing:false};
  },
  componentDidMount: function() {
    $.getJSON(this.props.src, function( data ) {
      this.setState({issue:data});
    }.bind(this));
  },
  edit: function(e) {
    this.setState({editing: !this.state.editing})
    mdlUpgradeDom();
    e.preventDefault();
  },
  save: function(e) {
    var title = $('#issue_title').val();
    $.post('/update/'+this.state.issue.id, {title:title}, function() {
      this.setState({
        editing: false,
        issue:{title: title}
      })
    }.bind(this));
    e.preventDefault();
  },
  render: function() {
    var dirty = this.state.dirty ? (
      <a href='' onClick={this.commit}>
        <i className="material-icons" style={{fontSize:'12pt', verticalAlign:'text-bottom', marginLeft:'.5em'}}>warning</i>
      </a>
    ) : '';
    var author = '';
    if (this.state.issue.author) {
      style = {fontSize:'12pt', color:this.state.issue.resolved ? 'red' : 'green', verticalAlign:'text-bottom', marginLeft:'.5em'};
      author = (
        <div style={{marginTop:'-24px'}}>
          <AuthorSig author={this.state.issue.author} /> at {this.state.issue.created_at}
          <i className="material-icons" style={style}>error_outline</i>
          {dirty}
        </div>
      );
    }
    var title;
    if (this.state.editing) {
      title = (
        <div style={{margin:'1em;'}}>
          <div className="mdl-textfield mdl-js-textfield textfield-demo">
            <input className="mdl-textfield__input" type="text" id="issue_title" defaultValue={this.state.issue.title} />
            <label className="mdl-textfield__label" for="issue_title">Title...</label>
          </div>
          <button className="mdl-button mdl-js-button mdl-button--raised" onClick={this.save} style={{marginLeft:'1em'}}>
            Save
          </button>
          <button className="mdl-button mdl-js-button mdl-js-ripple-effect" onClick={this.edit} style={{marginLeft:'1em'}}>
            Cancel
          </button>
        </div>
      );
    } else {
      title = (
        <h2>
          {this.state.issue.title}
          <a href='#' onClick={this.edit}><i className="material-icons" style={{marginLeft:'.5em'}}>edit</i></a>
        </h2>
      );
    }
    return (

      <div className="mdl-grid">
        <div className="mdl-cell mdl-cell--9-col">
          { title }
          {author}
          <div style={{marginLeft:'-1em'}}>
            <CommentList src={this.state.issue.comments_url} />
          </div>
          <NewCommentForm reply_to={this.state.issue.id} closeButton={!this.state.issue.resolved} reopenButton={this.state.issue.resolved} />
        </div>
        <div className="mdl-cell mdl-cell--3-col">
          <LabelController issue={this.state.issue} />
        </div>
      </div>
    );
  }
});


React.render(
  <Frame>
    <Issue src={document.location+'.json'} />
  </Frame>,
  document.getElementById('content')
);

