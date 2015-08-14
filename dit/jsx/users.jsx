var UserList = React.createClass({
  getInitialState: function() {
    return {users: []};
  },
  componentDidMount: function() {
    $.getJSON(this.props.url, function( data ) {
      this.setState(data);
    }.bind(this));
    mdlUpgradeDom();
  },
  render: function() {
    var nodes = this.state.users.map(function (user) {
      return (
        <UserLI data={user} />
      );
    }.bind(this));
    var none = (
      <tr>
        <td className="mdl-data-table__cell--non-numeric" colSpan='2'>
          No users...
        </td>
      </tr>
    );
    return (
      <div>
        <table className="mdl-data-table mdl-js-data-table mdl-shadow--2dp">
          <thead>
            <tr>
              <th className="mdl-data-table__cell--non-numeric">Name</th>
              <th className="mdl-data-table__cell--non-numeric">Email</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length ? nodes : none}
          </tbody>
        </table>
      </div>
    );
  },
});


var UserLI = React.createClass({
  render: function() {
    return (
      <tr key={this.props.data.id}>
        <td className="mdl-data-table__cell--non-numeric">
          <User data={this.props.data} />
        </td>
        <td className="mdl-data-table__cell--non-numeric">
          {this.props.data.email}
        </td>
      </tr>
    );
  }
});


React.render(
  <Frame>
    <UserList url="/users.json" />
  </Frame>,
  document.getElementById('content')
);

