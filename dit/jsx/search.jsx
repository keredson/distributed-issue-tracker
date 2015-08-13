function qs(key) {
    key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
    var match = location.search.match(new RegExp("[?&]"+key+"=([^&]+)(&|$)"));
    return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}

var Search = React.createClass({
  getInitialState: function() {
    return {q:qs('q'), items:[]};
  },
  componentDidMount: function() {
    setTimeout(function() {
      this.refs.q.getDOMNode().focus(); 
      if (this.state.q) this.update()
    }.bind(this), 100);
  },
  update: function(e) {
    var q = $(this.refs.q.getDOMNode()).val();
    this.setState({q:q})
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
        if (item.label) {
          desc = (
            <div>
              <Author author={item.author}/> {item.kind=='added_label' ? "added" : "removed"} label <Label data={item.label}/> to <a href={'/issues/'+item.reply_to_short_id}>{item.reply_to_desc}</a> on {item.created_at}.
            </div>
          )
        } else {
          desc = (
            <div>
              <div>
                <Author author={item.author}/> replied to <a href={'/issues/'+item.reply_to_short_id}>{item.reply_to_short_id}</a> on {item.created_at}:
              </div>
              {item.text}
            </div>
          )
        }
      }
      if (item.__class__=='Label') {
        desc = (
          <div>
            <Author author={item.author}/> created <Label data={item}/> on {item.created_at}.
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
    if (results.length==0) {
      if (this.state.q) {
        results = (
          <div style={{marginLeft:'1em'}}>
            No results found.
          </div>
        )
      } else {
        results = (
          <div style={{marginLeft:'1em'}}>
            Please search for something...
          </div>
        )
      }
    }
    return (
      <div>
        <form action="#" style={{margin:'2em'}}>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:'100%'}}>
            <input className="mdl-textfield__input" type="text" id="sample1" ref='q' onChange={this.update} defaultValue={this.state.q} />
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

