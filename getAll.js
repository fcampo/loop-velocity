"use strict";

var URL = "https://bugzilla.mozilla.org/rest/bug?id=";
var options = {
  "include_fields": ["id", "summary", "depends_on"]
};

var checkedBugs = {};

function getOptions() {
  var result = "";
  for (var a in options) {
    result += "&" + a + "=" + [].concat(options[a]).join(",");
  }
  return result;
}

function isMeta(bug) {
  let lower = bug.summary.toLowerCase();
  return lower.indexOf("meta") !== -1;
}

function getBug(bugList) {
  var query = URL + bugList + getOptions();
  console.log('QUERY > ' + query);
  //console.log('> getting bug ' + bugNumber);
  return fetch(query).then(response => {
    return response.json();
  }).then(data => {
    //console.log('> ID = ' + data.bugs[0].summary);
    bugList.split(',').forEach(num => {
      console.log('keeping ' + num + ' on the hash');
      checkedBugs[num] = true;
    });
    return data;//.bugs[0];
  });
}

function getDependencies(bug) {
//  console.log('> getting dependencies');
  return bug.depends_on.reduce((p,c) => {
    //console.log('> dependent on ' + c);
    return p.then(partial => {
      return getAll(c).then(depList => {
        return partial.concat(depList);
      })
    });
  }, Promise.resolve([]));
}

function getAll(bugNumber) {
  if (!!checkedBugs[bugNumber]) {
    return Promise.resolve([]);
  }

  var list = [];
  //console.log('> getting ALL for ' + bugNumber);
  return getBug(bugNumber).then(bug => {
    if (!isMeta(bug)) {
      //console.log(bug.id + ' NOT meta!');
      list.push(bug);
    }
    return getDependencies(bug).then(depList => {
      return list.concat(depList);
    });
  });
}

function getBug2(bugList) {
  var query = URL + bugList + getOptions();
  //console.log('QUERY > ' + query);
  //console.log('> getting bug ' + bugNumber);
  return fetch(query).then(response => {
    return response.json();
  }).then(data => {
    //console.log('> ID = ' + data.bugs[0].summary);
    var dataList = data.bugs;
    dataList.forEach((bug, pos) => {
      if (!!checkedBugs[bug.id]) {
        //console.log(bug.id + ' REPE');
        dataList.splice(pos, 1);
      } else {
        //console.log('keeping ' + bug.id + ' on the hash');
        checkedBugs[bug.id] = true;
      }
    });
    return data.bugs;
  });
}

function getDependencies2(bugList) {
  //console.log('> getting dependencies of ' + JSON.stringify(bugList));
  return bugList.reduce((p,c) => {
    return p.then(partial => {
      return getAll2(c.depends_on).then(depList => {
        return partial.concat(depList);
      });
    });
  }, Promise.resolve([]));
}

function getAll2(bugArray) {
  //console.log('> getting ALL of ' + bugArray);
  var list = [];
  // convert to Array just in case
  bugArray = [].concat(bugArray);
  if (!bugArray.length) {
    return Promise.resolve([]);
  }
  return getBug2(bugArray.join(',')).then(bugList => {
    bugList.forEach(bug => {
      //if (!isMeta(bug)) {
        //console.log('+++ AÑADIENDO ' + bug.id);
        list.push(bug.id); //TODO
      //}
    });
    return getDependencies2(bugList).then(depList => {
      return list.concat(depList);
    });
  });
}


// META 1248602
// NON-F  1248604
// leaf 1250107
var a = [1248602, 1248603, 1248604];
var inter = window.setInterval(function () {
  console.log('... thinking...');
}, 800);
getAll2(1248602).then(list => {
  console.log('RESULT > ' + JSON.stringify(list));
  console.log('RESULT > ' + list.length);
  window.clearInterval(inter);
});

//getAll(1248602).then(finalList => {
//  console.log('>>> TOTAL - ' + JSON.stringify(finalList));
//  console.log('>>>  num - ' + finalList.length);
//}).catch(err => {
//  console.error(err);
//});
