
var ErrorPage = React.createClass({
  getInitialState: function() {
    return {};
  },
  componentDidMount: function() {
    mdlUpgradeDom();
  },
  render: function() {
    return (
      <div>
        <center style={{marginTop:'4em'}}>I don't know what you're looking for...</center>
        <center><i className="material-icons" style={{fontSize:'144pt'}}>favorite_border</i></center>
        <center>...but I love you anyway!</center>
      </div>
    );
  }
});


React.render(
  <Frame>
    <ErrorPage />
  </Frame>,
  document.getElementById('content')
);

