
var UserPage = React.createClass({
  getInitialState: function() {
    return {user:{name:''}};
  },
  componentDidMount: function() {
    this.load()
  },
  load: function() {
    $.getJSON(this.props.src, function( data ) {
      this.setState({user:data});
    }.bind(this));
  },
  render: function() {
    return (
      <h1>
        {this.state.user.name}
      </h1>
    );
  }
});


React.render(
  <Frame>
    <UserPage src={document.location+'.json'} />
  </Frame>,
  document.getElementById('content')
);

