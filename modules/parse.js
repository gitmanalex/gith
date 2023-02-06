import { renderCommitsInDialog, renderAuthorCommitsInDialog } from "./uiupdate.js";

var g_commits;
var g_arr;

function parseText(text) {
  console.log("Start Parsing Log Entries");

  // split the text in commits
  // https://medium.com/@shemar.gordon32/how-to-split-and-keep-the-delimiter-s-d433fb697c65
  let regex = /(?=commit [A-Za-z0-9]{40}[\n])|(?<=commit [A-Za-z0-9]{40}[\n])/i;

  let commits = joinCommitWithBody(text.split(regex));

  g_commits = commits;

  let cArr = parseCommits(commits);
  g_arr = cArr;

  showFileTable(cArr);
}

function showAuthorsTable() {
  let authorChange = buildAuthorsAmount(g_arr);
  let cols = [];
  for (let a of authorChange.aca) {
    cols.push({ name: a[0], change: a[1], cmts: authorChange.acc.get(a[0]) });
  }

  if ($.fn.dataTable.isDataTable("#tableFiles")) {
    $("#tableFiles").DataTable().destroy();
    $("#tableFiles").hide();
  }

  if ($.fn.dataTable.isDataTable("#tableAuthors")) {
    $("#tableAuthors").DataTable().destroy();
  }

  $("#tableAuthors").DataTable({
    bAutoWidth: false,
    order: [[0, "desc"]],
    pageLength: 25,
    data: cols,
    columns: [
      { data: "change" },
      { data: "cmts" },
      {
        data: "name",
        render: function (data, type) {
          let img = $("<img>")
            .addClass("j-commitViewForAuthor")
            .attr("src", "/img/commit-git.png");
          let txt = $("<span>").text(data);
          return $("<div>").append(img).append(txt).html();
        },
      },
    ],
  });
  $("#tableAuthors").show();

  $(".j-commitViewForAuthor").click(function () {
    authorLog($($(this).siblings()[0]).text());
  });
  $(".j-inputForm").hide();
  $(".j-processPanel").show();
}

function showFileTable(cArr) {
  if(cArr == undefined) {
    cArr = g_arr;
  }
  showDatepicker(cArr);

  let fileChange = buildFileChangeAmount(cArr);
  let cols = [];
  for (let f of fileChange.fca) {
    cols.push({ name: f[0], change: f[1], cmts: fileChange.fcc.get(f[0]) });
  }

  if ($.fn.dataTable.isDataTable("#tableFiles")) {
    $("#tableFiles").DataTable().destroy();
  }

  if ($.fn.dataTable.isDataTable("#tableAuthors")) {
    $("#tableAuthors").DataTable().destroy();
    $("#tableAuthors").hide();
  }

  $("#tableFiles").DataTable({
    bAutoWidth: false,
    order: [[0, "desc"]],
    pageLength: 50,
    data: cols,
    columns: [
      { data: "change" },
      { data: "cmts" },
      {
        data: "name",
        render: function (data, type) {
          let img = $("<img>")
            .addClass("j-commitView")
            .attr("src", "/img/commit-git.png");
          let txt = $("<span>").text(data);
          return $("<div>").append(img).append(txt).html();
        },
      },
    ],
  });
  $("#tableFiles").show();

  $(".j-commitView").click(function () {
    fileLog($($(this).siblings()[0]).text());
  });
  $(".j-inputForm").hide();
  $(".j-processPanel").show();
}

function buildAuthorsAmount(cArr) {
  const aMap = new Map();
  const aCC = new Map();
  // c is an object with: hash, author, authorEmail, date, title, files
  // files is an array with: changeA, changeR, change, name
  for (let c of cArr) {
    // count commits per author
    if (aCC.has(c.author)) {
      let old = aCC.get(c.author);
      aCC.set(c.author, old + 1);
    } else {
      aCC.set(c.author, 1);
    }

    for (let f of c.files) {
      // count changes
      if (!isNaN(f.change))
        if (aMap.has(c.author)) {
          let old = aMap.get(c.author);
          aMap.set(c.author, old + f.change);
        } else {
          aMap.set(c.author, f.change);
        }
    }
  }
  // author change amount and author change count
  return { aca: aMap, acc: aCC };
}

function buildFileChangeAmount(cArr) {
  const fileMap = new Map();
  const fileCC = new Map();
  for (let c of cArr) {
    for (let f of c.files) {
      // count commits
      if (fileCC.has(f.name)) {
        let old = fileCC.get(f.name);
        fileCC.set(f.name, old + 1);
      } else {
        fileCC.set(f.name, 1);
      }

      // count changes
      if (fileMap.has(f.name)) {
        let old = fileMap.get(f.name);
        fileMap.set(f.name, old + f.change);
      } else {
        fileMap.set(f.name, f.change);
      }
    }
  }

  // Convert the map into an array
  var array = [...fileMap];

  // Set up a sorting function that sort in ascending value order
  var sortFunction = (a, b) => b[1] - a[1];
  return { fca: array.sort(sortFunction), fcc: fileCC };
}

function authorLog(author) {
  console.log("extract author log and show on dialog");
  let al = [];
  for (let c of g_arr) {
    if (c.author == author) {
      al.push(c);
      continue;
    }
  }

  al.sort(function (a, b) {
    return b.date - a.date;
  });

  renderAuthorCommitsInDialog(al, author);
}

function fileLog(fileName) {
  console.log("extract file log and show on dialog");
  let cl = [];
  for (let c of g_arr) {
    for (let f of c.files) {
      if (f.name == fileName) {
        cl.push(c);
        continue;
      }
    }
  }

  cl.sort(function (a, b) {
    return b.date - a.date;
  });
  renderCommitsInDialog(cl, fileName);
}

function showDatepicker(cArr) {
  // set the oldest date
  let oldestDate = getOldestDateFromCommits(cArr);
  $("#firstEdit").datepicker({
    changeMonth: true,
    changeYear: true,
    minDate: oldestDate,
    maxDate: new Date(),
    dateFormat: "d M, y",
    onSelect: function (dateText) {
      showFileTable(parseCommits(g_commits, new Date(dateText)));
    },
  });
  $("#firstEdit").datepicker("setDate", oldestDate);
}

function getOldestDateFromCommits(commits) {
  let lc = commits.sort(function (a, b) {
    return a.date - b.date;
  });

  return new Date(lc[0].date);
}

function parseCommits(commits, date) {
  console.log("Parse individual commits");

  let cList = [];
  for (let c of commits) {
    let lines = c.split("\n");
    let title = figureTitle(lines);
    if (lines[1].startsWith("Merge:")) {
      continue;
    }

    let cDate = Date.parse(lines[2].substring(8));

    // filter by date
    if (date != undefined && cDate < date.getTime()) {
      continue;
    }

    cList.push({
      hash: lines[0].substring(7),
      author: lines[1].substring(8).split(" <")[0],
      authorEmail: lines[1].substring(8).split(" <")[1].slice(0, -1),
      date: cDate,
      title: title,
      files: extractFileChanges(lines, title),
    });
  }

  return cList;
}

function extractFileChanges(lines, title) {
  let revLines = lines.reverse();

  let files = [];
  for (let l of revLines) {
    if (l == "") continue;

    if (title.includes(l)) {
      break;
    }

    let lc = l.split("\t"); // line chunks
    files.push({
      changeA: parseInt(lc[0]),
      changeR: parseInt(lc[1]),
      change: parseInt(lc[0]) + parseInt(lc[1]),
      name: lc[2],
    });
  }
  return files;
}

function figureTitle(lines) {
  let title = [];
  for (let l of lines) {
    if (l.startsWith(" ")) {
      title.push(l);
    }
  }
  return title.join();
}

function joinCommitWithBody(commits) {
  let holeCommits = [];
  for (let i = 0; i < commits.length; i += 2) {
    holeCommits.push(commits[i] + commits[i + 1]);
  }
  return holeCommits;
}

export { parseText, fileLog, showFileTable, showAuthorsTable };
