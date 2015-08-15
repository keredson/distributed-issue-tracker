var LabelList = React.createClass({
  getInitialState: function() {
    return {labels: [], issue_counts: {}};
  },
  componentDidMount: function() {
    $.getJSON(this.props.url, function( data ) {
      this.setState(data);
    }.bind(this));
  },
  reload: function() {
    this.componentDidMount()
  },
  addLabel: function() {
    $.getJSON(this.props.url+'?new=true', function( data ) {
      this.setState(data);
    }.bind(this));
  },
  componentDidUpdate: function(prevProps, prevState) {
    mdlUpgradeDom();
  },
  update: function(id, text) {
    for (var i=0; i<this.state.labels.length; ++i) {
      var label = this.state.labels[i];
      if (label.id==id) {
        label.name = text
      }
    }
    this.setState(this.state);
  },
  render: function() {
    var nodes = this.state.labels.map(function (label) {
      return (
        <LabelLI data={label} issue_counts={this.state.issue_counts} update={this.update} reload={this.reload}/>
      );
    }.bind(this));
    var none = (
      <tr>
        <td className="mdl-data-table__cell--non-numeric" colSpan='4'>
          No labels...
        </td>
      </tr>
    );
    return (
      <div>
        <table className="mdl-data-table mdl-js-data-table mdl-shadow--2dp">
          <thead>
            <tr>
              <th className="mdl-data-table__cell--non-numeric">Label</th>
              <th className="mdl-data-table__cell--non-numeric">Color</th>
              <th className="mdl-data-table__cell--non-numeric">Deadline</th>
              <th className="mdl-data-table__cell--non-numeric">Issues</th>
              <th className="mdl-data-table__cell--non-numeric"></th>
            </tr>
          </thead>
          <tbody>
            {nodes.length ? nodes : none}
          </tbody>
        </table>
      <button className="mdl-button mdl-js-button mdl-button--fab mdl-button--colored" style={{position:'fixed', bottom:'1em', right:'1em'}} onClick={this.addLabel}>
        <i className="material-icons">add</i>
      </button>
      </div>
    );
  },
});


var LabelLI = React.createClass({
  getInitialState: function() {
    return {editing: this.props.data.editing};
  },
  edited: function() {
    var new_text = $(React.findDOMNode(this.refs.editMe)).val();
    this.props.update(this.props.data.id, new_text)
  },
  save: function() {
    var new_text = $(React.findDOMNode(this.refs.editMe)).val();
    var data = this.props.data;
    data.name = new_text;
    $.post('/update/'+data.id, data, function() {
      this.setState({editing:false})
      this.props.reload();
    }.bind(this))
  },
  edit: function(e) {
    this.state.editing = !this.state.editing
    this.setState(this.state)
    e.preventDefault();
  },
  componentDidUpdate: function(prevProps, prevState) {
    mdlUpgradeDom();
  },
  render: function() {
    var edit = (
      <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{marginTop:'-20px', marginBottom:'-20px'}}>
        <input className="mdl-textfield__input" type="text" id="name_{this.props.data.id}" onChange={this.edited} ref="editMe" defaultValue={this.props.data.name}/>
        <label className="mdl-textfield__label" htmlFor="name_{this.props.data.id}">Name...</label>
      </div>
    );
    var editButtons
    if (this.state.editing) {
      editButtons = (
        <div style={{marginTop:'-6px'}}>
          <button className="mdl-button mdl-js-button mdl-button--raised" onClick={this.save}>
            Save
          </button>
          <button className="mdl-button mdl-js-button mdl-js-ripple-effect" onClick={this.edit} style={{marginLeft:'1em'}}>
            Cancel
          </button>
        </div>
      );
    } else {
      editButtons = (
        <a href='' onClick={this.edit}>
          <i className="material-icons" style={{fontSize:'12pt'}}>edit</i>
        </a>
      );
    }
    return (
      <tr key={this.props.data.id}>
        <td className="mdl-data-table__cell--non-numeric">
          {this.state.editing ? edit : this.props.data.name || "(undefined)"}
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          <Label data={this.props.data} />
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          {this.props.data.deadline || ''}
        </td>
        <td>
          {this.props.issue_counts[this.props.data.id]}
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          {editButtons}
        </td>
      </tr>
    );
  }
});


React.render(
  <Frame>
    <LabelList url="/labels.json" />
  </Frame>,
  document.getElementById('content')
);

