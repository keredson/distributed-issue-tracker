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
        <button className="mdl-button mdl-js-button mdl-button--fab mdl-button--colored" style={{position:'fixed', bottom:'1em', right:'1em'}} onClick={function() {document.location="/issues/new"}}>
          <i className="material-icons">add</i>
        </button>
      </div>
    );
  },
});

var IssueLI = React.createClass({
  render: function() {
    var labels = this.props.data.labels.map(function (label) {
      return (
        <Label data={label} weight={this.props.data.label_weights[label.id]}/>
      );
    }.bind(this));
    return (
      <tr>
        <td className="mdl-data-table__cell--non-numeric">
          <a href={this.props.data.url}>{this.props.data.short_id}</a>
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          {this.props.data.title} {labels}
        </td>
        <td style={{color: this.props.data.comment_count ? '' : '#ddd'}}>
          {this.props.data.comment_count}
          <i className="material-icons" style={{marginLeft:'.2em', fontSize:'10pt', verticalAlign:'text-bottom'}}>comment</i>
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          <IssueResolvedState resolved={this.props.data.resolved} />
        </td>
      </tr>
    );
  }
});

React.render(
  <Frame>
    <IssueList url="issues.json" />
  </Frame>,
  document.getElementById('content')
);

