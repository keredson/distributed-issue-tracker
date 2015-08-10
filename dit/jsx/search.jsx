var Search = React.createClass({
  getInitialState: function() {
    return {q:'', items:[]};
  },
  componentDidMount: function() {
    setTimeout(function() {
      this.refs.q.getDOMNode().focus(); 
    }.bind(this), 50);
  },
  update: function(e) {
    var q = $(this.refs.q.getDOMNode()).val();
    $.getJSON('/search.json', {q:q}, function(data){
      this.setState(data);
    }.bind(this));
  },
  render: function() {
    var results = this.state.items.map(function (item) {
      var desc;
      if (item.__class__=='User') {
        desc = (
          <span>
            {item.name} &lt;<a href={'mailto:'+item.email}>{item.email}</a>&gt;
          </span>
        )
      }
      if (item.__class__=='Issue') {
        desc = (
          <span>
            <a href={'/issue/'+item.short_id}>{item.short_id}</a>: {item.title}
          </span>
        )
      }
      if (item.__class__=='Comment') {
        desc = (
          <div>
            <div>
              In reply to <a href={'/issues/'+item.reply_to_short_id}>{item.reply_to_short_id}</a>:
            </div>
            {item.text}
          </div>
        )
      }
      return (
        <div className="mdl-card mdl-shadow--2dp demo-card-wide" style={{minHeight:"1px", width:"auto", 'margin':'.5em 0em'}} 
            key={item.id}>
          <div className="mdl-card__supporting-text">
            {desc}
          </div>
        </div>
      );
    });
    return (
      <div>
        <form action="#" style={{margin:'2em'}}>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:'100%'}}>
            <input className="mdl-textfield__input" type="text" id="sample1" ref='q' onChange={this.update} />
            <label className="mdl-textfield__label" htmlFor="sample1">Search...</label>
          </div>
        </form>
      {results}
      </div>
    );
  },
});



React.render(
  <Frame>
    <Search />
  </Frame>,
  document.getElementById('content')
);

