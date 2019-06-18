function techno_to_logo(technologyName) {
  const custom_techno_to_logo = {javascript: 'js'}
  technologyName = custom_techno_to_logo[technologyName] || technologyName


  let extension = (new Set(['angular2', 'js', 'rabbitmq', 'pytorch'])).has(technologyName) ? 'jpg' : 'png'
  return `${technologyName}.${extension}`
}


function renderTechnology(t) {
  return `
<div style="display: inline-block; position:relative">
<img src="/assets/ld/${techno_to_logo(t)}" width="26px" height="26px" class="with-tooltip"/>
<span class="tooltip">${t}</span>
</div>
`
}


function renderProject(p) {
  let technologiesRendered = p.technologies.map(renderTechnology).reduce((a, b) => a + b, '')

  return `
<div class="ld-project" style="display: flex; flex-direction: column; justify-content: space-between;">

  <space style="flex: 1 0 auto"></space>
  
  <div class="ld-company-header">
    <div style="width: 200px; text-align: center"> 
      <img src="${p.logo}" style="max-width: 200px" /> 
      <!--width="200px"/>-->
    </div>
    <div class="ld-company-header-name-link" >
      <p style="margin-left: 10px; margin-bottom: 0; font-weight: bold">${p.company}</p>
      <a style="margin-left: 10px;" href="${p.website}">${p.website}</a>
    </div>
  </div>
  

  <div style="flex: 1 0 auto">
    
    ${p.body}
    
  </div>
  <space style="flex: 1 0 auto"></space>
  
  <div>
 ${technologiesRendered} 
</div>


</div>

`
}


let store = {
  projects: [
    {
      company: "Recurse Center",
      logo: "/assets/ld/rc.png",
      website: "https://recurse.com",
      body: `I spent 3 months at the recurse center, a self-directed retreat to become a better programmer.
      <ul>
      <li>Published my <a href="/deploy-docker-app/">first blog post</a></li>
      <li>Worked on writing a LLVM frontend for C in Python (<a href="https://github.com/ldirer/compyler">github</a>)</li>
      <li>Wrote a shakespeare bot (text generation) using deep learning, took the fastai classes, took (half) an OS course...</li>
      <li>Most importantly I met and worked with amazing people and programmers.</li>
    </ul>
      
      `,
      technologies: ["python", "flask", "javascript", "vuejs", "docker", "postgresql", "pytorch"]
    },

    {
      company: "Personal project",
      logo: "/assets/ld/onefeed.png",
      website: "http://onefeed.cc",
      body: `A single-page app to aggregate feeds from facebook pages and groups.
      Feel free to try it out!
      <div>Deployed on aws.</div>
      `,
      technologies: ["python", "flask", "javascript", "vuejs", "bulma", "celery", "docker", "postgresql"]
    },
    {
    company: "SkillCorner",
    logo: "/assets/ld/skillcorner.jpg",
    website: "http://skillcorner.com",
    body: `
I helped build the startup's first product, a live game display of football players positions on the pitch.
<ul>
<li>Set up coding practices: add tests, continuous integration, systematic code reviews.</li>
<li>Made the video processing steps run in parallel to improve fps throughput.</li>
<li>Took over web development, migrating the app from angular2 beta to stable version, from gulp to angular-cli.</li>
<li>Set up automatic provisioning and deployment to several machines (on-demand, need to launch new machines to process a game).</li>
</ul>
Skillcorner (successfully) went live on a leading French bookmaker website for the 2018 World Cup.
`,
    technologies: ["python", "django", "celery", "rabbitmq",
      "redis", "docker", "ansible", "javascript", "angular2", "postgresql", "grafana", "graphite", "statsd"]
  },
    {
      company: "Gorgias",
      logo: "/assets/ld/gorgias.png",
      website: "https://gorgias.io/",
      body: `
      <ul>
        <li>Part of a 3 to 4-person development team working on the next-generation helpdesk (in beta version at the time).</li>
        <li> Worked on fullstack features:
        <ul>
          <li>Added Facebook and Messenger integration for pages and businesses to seamlessly receive and send messages in the helpdesk.</li>
          <li>Automatically send customer rating survey a little while after a customer issue is marked as resolved.</li>
        </ul>
        </li>
        </li>
      </ul>
`,
      technologies: ["python", "flask", "reactjs", "javascript", "docker", "celery", "rabbitmq", "postgresql"]
    }
  ]

}


function render() {

  let html = "";
  for (let p of store.projects) {
    html += renderProject(p)
  }

  return html
}


window.onload = () => {
  let container = document.getElementById('projects')
  container.innerHTML = render()
}
