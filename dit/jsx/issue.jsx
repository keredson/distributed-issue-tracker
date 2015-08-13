
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
  doLabel: function(action, label_id) {
    var d = {}
    d[action] = label_id;
    $.post('/reply-to/'+this.props.issue.id, d, function() {
      console.log(this.props)
      this.setState({editing: false})
      this.props.reload();
    }.bind(this))
  },
  render: function() {
    var label_part;
    if (this.state.editing) {
      var hasLabelIds = {}
      var labels = this.props.issue.labels.map(function (label) {
        hasLabelIds[label.id] = true
      }.bind(this));
      var all_labels = this.state.labels.map(function (label) {
        if (label.name.toLowerCase().indexOf(this.state.q) == -1) {
          return <span />
        }
        var add_label = <i className="material-icons" style={{color:'#808080', fontSize:'11pt', verticalAlign:'middle'}}>add</i>;
        var my_weight = this.props.issue.my_label_weights[label.id] || 0;
        var label_weight = this.props.issue.label_weights[label.id] || 0;
        console.log(label.name, my_weight, label_weight)
        if (my_weight<=0) {
          var click = function(e) {
            this.doLabel('add_label', label.id);
            e.preventDefault();
          }.bind(this);
          add_label = (
            <a href='' onClick={click} style={{color:label.fg_color}}>
              <i className="material-icons" style={{fontSize:'11pt', verticalAlign:'middle'}}>add</i>
            </a>
          );
        }
        var remove_label = <i className="material-icons" style={{color:'#808080', fontSize:'11pt', verticalAlign:'middle'}}>clear</i>;
        if (my_weight>0 || (label_weight>0 && my_weight==0)) {
          var click = function(e) {
            this.doLabel('remove_label', label.id);
            e.preventDefault();
          }.bind(this);
          remove_label = (
            <a href='' onClick={click} style={{color:label.fg_color}}>
              <i className="material-icons" style={{fontSize:'11pt', verticalAlign:'middle'}}>clear</i>
            </a>
          );
        }
        return (
          <span>
            <div style={{padding:'.1em .5em', margin:'.5em', backgroundColor:label.bg_color, color:label.fg_color}} className='mdl-shadow--2dp'>
              {label.name || '---'}
              <span style={{fontSize:'11pt', float:'right', clear:'right'}}>
                {add_label}  {remove_label}
              </span>
            </div>
          </span>
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
      var labels = this.props.issue.labels.map(function (label) {
        var label_node = <Label data={label} block={true} weight={this.props.issue.label_weights[label.id]}/>;
        if (this.props.issue.label_weights[label.id]==1) {
          return label_node
        } else {
          var user_nodes = [];
          for (var user_id in this.props.issue.label_user_weights[label.id]) {
            var weight = this.props.issue.label_user_weights[label.id][user_id]
            if (weight==0) return <span/>;
            var user = this.props.issue.participants[user_id]
            var sentiment = weight>0 ? (<span style={{color:'green'}}>agrees</span>) : (<span style={{color:'red'}}>disagrees</span>)
            user_nodes.push(<div style={{marginLeft:'1em'}}>- <User data={user}/> {sentiment}</div>)
          }
          return (
            <div>
              {label_node}
              {user_nodes}
            </div>
          );
        }
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
        <div className="mdl-card__supporting-text" style={{width:'auto', paddingTop:this.state.editing ? '' : '0px'}}>
          {label_part}
        </div>
        <div className="mdl-card__menu">
          <button className="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect" onClick={this.edit}>
            <i className="material-icons" style={{fontSize:'12pt'}}>{this.state.editing ? 'clear' : 'edit'}</i>
          </button>
        </div>
      </div>        
    )
  },
});


var Participants = React.createClass({
  render: function() {
    var people = this.props.data.map(function (person) {
      return <div><User data={person} /></div>
    }.bind(this));
    return (
      <div className="mdl-card mdl-shadow--2dp" style={{width:'100%', marginTop:'1em', minHeight:'1px'}}>
        <div className="mdl-card__title">
          <h2 className="mdl-card__title-text">Participants</h2>
        </div>
        <div className="mdl-card__supporting-text" style={{width:'auto', paddingTop:'0px'}}>
          {people}
        </div>
      </div>        
    )
  }
});


var IssuePage = React.createClass({
  getInitialState: function() {
    return {issue:{title:'', labels:[]}, comments:[], editing:false};
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
    var people = []
    for (var id in this.state.issue.participants) {
      people.push(this.state.issue.participants[id])
    }
    return (
      <div className="mdl-grid">
        <div className="mdl-cell mdl-cell--9-col">
          { title }
          {author}
          <div style={{marginLeft:'-1em'}}>
            <CommentList comments={this.state.comments} reload={this.load}/>
          </div>
          <NewCommentForm reply_to={this.state.issue.id} closeButton={!this.state.issue.resolved} reopenButton={this.state.issue.resolved} reload={this.load} />
        </div>
        <div className="mdl-cell mdl-cell--3-col">
          <LabelController issue={this.state.issue} comments={this.state.comments} reload={this.load} />
          <Participants data={people} />
        </div>
      </div>
    );
  }
});


React.render(
  <Frame>
    <IssuePage src={document.location+'.json'} />
  </Frame>,
  document.getElementById('content')
);

