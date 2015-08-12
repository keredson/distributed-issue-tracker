var NewIssueForm = React.createClass({
  getInitialState: function() {
    return {title: '', id: ''};
  },
  render: function() {
    return (
      <form method='post'>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <input className="mdl-textfield__input" type="text" id="title" name='title' defaultValue={this.state.title} />
            <label className="mdl-textfield__label" for="title">Title</label>
          </div>
        </div>
        <div>
          <div className="mdl-textfield mdl-js-textfield textfield-demo" style={{width:"100%"}}>
            <textarea className="mdl-textfield__input" type="text" rows="10" name='comment' id="sample5" ></textarea>
            <label className="mdl-textfield__label" for="sample5">Details...</label>
          </div>
        </div>
        <div>
          <button className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent">
            {this.state.id ? "Save" : "Create"}
          </button>
        </div>
      </form>
    );
  }
});


React.render(
  <Frame>
    <NewIssueForm />
  </Frame>,
  document.getElementById('content')
);

