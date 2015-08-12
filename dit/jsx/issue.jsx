var Issue = React.createClass({
  getInitialState: function() {
    return {'title':'', editing:false};
  },
  componentDidMount: function() {
    $.getJSON(this.props.src, function( data ) {
      this.setState(data);
    }.bind(this));
  },
  edit: function(e) {
    this.setState({editing: !this.state.editing})
    mdlUpgradeDom();
    e.preventDefault();
  },
  save: function(e) {
    var title = $('#issue_title').val();
    $.post('/update/'+this.state.id, {title:title}, function() {
      this.setState({
        editing: !this.state.editing,
        title: title
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
    if (this.state.author) {
      style = {fontSize:'12pt', color:this.state.resolved ? 'red' : 'green', verticalAlign:'text-bottom', marginLeft:'.5em'};
      author = (
        <div style={{'margin-top':'-24px'}}>
          <AuthorSig author={this.state.author} /> at {this.state.created_at}
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
            <input className="mdl-textfield__input" type="text" id="issue_title" defaultValue={this.state.title} />
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
          {this.state.title}
          <a href='' onClick={this.edit}><i className="material-icons" style={{marginLeft:'.5em'}}>edit</i></a>
        </h2>
      );
    }
    return (
      <div>
        { title }
        {author}
        <div style={{marginLeft:'-1em'}}>
          <CommentList src={this.state.comments_url} />
        </div>
        <NewCommentForm reply_to={this.state.id} closeButton={!this.state.resolved} reopenButton={this.state.resolved} />
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

