
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
    }.bind(this), 200);
    mdlUpgradeDom();
  },
  updateSearch: function() {
    var q = $(this.refs.search.getDOMNode()).val().toLowerCase();
    this.setState({q:q})
  },
  edit: function(e) {
    this.setState({editing: !this.state.editing})
    e.preventDefault();
  },
  addLabel: function(label_id) {
    $.post('/reply-to/'+this.props.issue.id, {'add_label':label_id}, function() {
      console.log(this.props)
      this.setState({editing: false})
      this.props.reload();
    }.bind(this))
  },
  render: function() {
    var label_part;
    if (this.state.editing) {
      var all_labels = this.state.labels.map(function (label) {
        if (label.name.toLowerCase().indexOf(this.state.q) == -1) {
          return <span />
        }
        var click = function(e) {
          this.addLabel(label.id);
          e.preventDefault();
        }.bind(this);
        return (
          <a href='' style={{textDecoration:'none'}} onClick={click}>
            <div style={{padding:'.1em .5em', margin:'.5em', backgroundColor:label.bg_color, color:label.fg_color}} className='mdl-shadow--2dp'>
              {label.name || '---'}
              <i className="material-icons" style={{fontSize:'11pt', verticalAlign:'middle', float:'right', clear:'right'}}>add</i>
            </div>
          </a>
        );
      }.bind(this));
      label_part = (
        <div style={{marginTop:'-20px'}}>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{marginTop:'-20px'}}>
            <input className="mdl-textfield__input" type="text" id="sample1" onChange={this.updateSearch} ref='search'/>
            <label className="mdl-textfield__label" htmlFor="sample1">Search...</label>
          </div>
          {all_labels}
        </div>
      )
    } else {
      var labels = this.props.comments.map(function (comment) {
        if (!comment.label) return <span/>
        return (
          <div style={{padding:'.1em .5em', margin:'.5em', backgroundColor:comment.label.bg_color, color:comment.label.fg_color}} className='mdl-shadow--2dp'>
            {comment.label.name || '---'}
          </div>
        )
      }.bind(this));
      label_part = (
        <div>
          {labels}
        </div>
      )
    }
    return (
      <div className="mdl-card mdl-shadow--2dp" style={{width:'100%', marginTop:'3em'}}>
        <div className="mdl-card__title">
          <h2 className="mdl-card__title-text">Labels</h2>
        </div>
        <div className="mdl-card__supporting-text" style={{width:'auto'}}>
          {label_part}
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
    return {issue:{'title':''}, comments:[], editing:false};
  },
  componentDidMount: function() {
    this.load()
  },
  load: function() {
    $.getJSON(this.props.src, function( data ) {
      $.getJSON(data['comments_url'], function( data2 ) {
        this.setState({issue:data, comments:data2['comments']});
      }.bind(this));
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
            <CommentList comments={this.state.comments} />
          </div>
          <NewCommentForm reply_to={this.state.issue.id} closeButton={!this.state.issue.resolved} reopenButton={this.state.issue.resolved} />
        </div>
        <div className="mdl-cell mdl-cell--3-col">
          <LabelController issue={this.state.issue} comments={this.state.comments} reload={this.load} />
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

