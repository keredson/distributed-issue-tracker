
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
      <div>
          <h1>
          {this.state.user.name}
        </h1>
        <div>
          <a href={'mailto:'+this.state.user.email}>{this.state.user.email}</a>
        </div>
      </div>
    );
  }
});


React.render(
  <Frame>
    <UserPage src={document.location+'.json'} />
  </Frame>,
  document.getElementById('content')
);

