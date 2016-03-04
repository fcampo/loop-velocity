"use strict";

/**
 *  Promise based queries for retrieving Bugzilla information
 *  Returns a list of every bug dependency from an other certain bug,
 *  including CLOSED bugs, and METAs
 *  Further queries and flters can be done after
 *
 *  @returns [int] List with all the bugIds
 *
 *  How to use:
 *  getAll(bugNumber).then(bugList => {
 *    let filtered = bugList.filter()
 *    // do something with the filtered list
 *  });
 */
var Bugziller = (function(namespace) {
  const QUERY_URL = "https://bugzilla.mozilla.org/rest/bug?";
  var fields = [
    "id",
    "summary",
    "resolution",
    "depends_on"
  ];
  var options = "include_fields" + fields.join(',') +
                "&product=Hello%20%28Loop%29";

  // hashtable to avoid repetitions
  var checkedBugs = {};

  // helper to add options to the query
  // TODO: not very useful at the moment, fix or kill
  // function getOptions() {
  //   var result = "";
  //   for (var a in options) {
  //     result += "&" + a + "=" + [].concat(options[a]).join(",");
  //   }
  //   return result;
  // }

  // checks if a specific bug is a [Meta]
  function isMeta(bug) {
    let lower = bug.summary.toLowerCase();
    return lower.indexOf("meta") !== -1;
  }

  // checks if a bug is closed, independently of the reason for it
  // (resolution != "")
  function isClosed(bug) {
    return !!bug.resolution;
  }

  // get basic info from bug(s)
  // bug details, immediate dependencies
  function getBug(bugArray) {
    let bugList = bugArray.join(',');
    let query = QUERY_URL + options + "&id=" + bugList;
    return fetch(query).then(response => {
      return response.json();
    }).then(data => {
      let dataList = data.bugs;
      dataList.forEach((bugData, position) => {
        // already checked, get rid of it
        if (!!checkedBugs[bugData.id]) {
          dataList.splice(position, 1);
        } else {
          // includes number in hashtable to not repeat searches
          checkedBugs[bugData.id] = true;
        }
      });
      // purged list
      return dataList;
    });
  }

  // get all the existing dependencies of a specific bugs
  // includes CLOSED bugs
  function getDependencies(bugList) {
    return bugList.reduce((p,c) => {
      return p.then(partial => {
        return getAll(c.depends_on).then(depList => {
          return partial.concat(depList);
        });
      });
    }, Promise.resolve([]));
  }

  // get everything related to a bug
  // details, dependencies, and subdependencies
  function getAll(bugArray) {
    var list = [];
    // convert to Array just in case
    bugArray = [].concat(bugArray);
    if (!bugArray.length) {
      return Promise.resolve([]);
    }
    return getBug(bugArray).then(infoArray => {
      infoArray.forEach(bug => {
        //if (!isMeta(bug)) { // we could get rid of [Meta] bugs here
          list.push(bug);
        //}
      });
      return getDependencies(infoArray).then(depends => {
        return list.concat(depends);
      });
    });
  }

  // get all data for a specific release based on the dates of it
  // commited:  all bugs that were assigned to someone during the release.
  //            They may or may not have been solved on time.
  // solved:    all bugs that were solved during the release.
  //            Could have been assigned on previous release though
  // complete:  100% on time. bugs that were assigned AND solved during the release
  function getAllFromDates(start, end) {
    let baseQuery = QUERY_URL + options;

    let commited = baseQuery +
      '';

  }

  function getReleaseData(release) {
    if (!release) {
      console.error(' - no RELEASE to check');
      return Promise.resolve();
    }
    // bug dependency
    if (release.bug) {
      return getAll(release.bug);
    }
    // date dependency
    return getAllFromDates(release.start, release.end);
  }

  return {
    getRel: getReleaseData,
    getAll: getAll,
    getOne: getBug,
    isMeta: isMeta,
    isClosed: isClosed
  };

})(window);

var UI = {
  results: document.getElementById('results'),
  loading: document.getElementById('loading')
};

const RELEASES = [
  {
    type: "FF",
    name: "34.1",
    start: "05/08/2014",
    end: "19/08/2014"
  },
  {
    type: "FF",
    name: "34.2",
    start: "19/08/2014",
    end: "02/09/2014"
  },
  {
    type: "FF",
    name: "34.3",
    start: "02/09/2014",
    end: "16/09/2014"
  },
  {
    type: "FF",
    name: "35.1",
    start: "16/09/2014",
    end: "30/09/2014"
  },
  {
    type: "FF",
    name: "35.2",
    start: "30/09/2014",
    end: "14/10/2014"
  },
  {
    type: "FF",
    name: "35.3",
    start: "14/10/2014",
    end: "28/10/2014"
  },
  {
    type: "FF",
    name: "36.1",
    start: "28/10/2014",
    end: "11/11/2014"
  },
  {
    type: "FF",
    name: "36.2",
    start: "11/11/2014",
    end: "09/12/2014"
  },
  {
    type: "FF",
    name: "36.3",
    start: "09/12/2014",
    end: "22/12/2014"
  },
  {
    type: "FF",
    name: "37.1",
    start: "22/12/2014",
    end: "05/01/2015"
  },
  {
    type: "FF",
    name: "37.2",
    start: "05/01/2015",
    end: "13/01/2015"
  },
  {
    type: "FF",
    name: "37.3",
    start: "13/01/2015",
    end: "26/01/2015"
  },
  {
    type: "FF",
    name: "38.1",
    start: "26/01/2015",
    end: "09/02/2015"
  },
  {
    type: "FF",
    name: "38.2",
    start: "09/02/2015",
    end: "23/02/2015"
  },
  {
    type: "FF",
    name: "38.3",
    start: "23/02/2015",
    end: "09/03/2015"
  },
  {
    type: "FF",
    name: "39.1",
    start: "09/03/2015",
    end: "23/03/2015"
  },
  {
    type: "FF",
    name: "39.2",
    start: "23/03/2015",
    end: "30/03/2015"
  },
  {
    type: "FF",
    name: "39.3",
    start: "30/03/2015",
    end: "13/04/2015"
  },
  {
    type: "FF",
    name: "40.1",
    start: "13/04/2015",
    end: "27/04/2013"
  },
  {
    type: "FF",
    name: "40.2",
    start: "27/04/2013",
    end: "11/05/2013"
  },
  {
    type: "FF",
    name: "40.3",
    start: "11/05/2013",
    end: "25/05/2015"
  },
  {
    type: "FF",
    name: "41.1",
    start: "25/05/2015",
    end: "08/06/2015"
  },
  {
    type: "FF",
    name: "41.2",
    start: "08/06/2015",
    end: "29/06/2015"
  },
  {
    type: "FF",
    name: "41.3",
    start: "29/06/2015",
    end: "13/07/2015"
  },
  {
    type: "FF",
    name: "42.1",
    start: "13/07/2015",
    end: "27/07/2015"
  },
  {
    type: "FF",
    name: "42.2",
    start: "27/07/2015",
    end: "10/08/2015"
  },
  {
    type: "FF",
    name: "42.3",
    start: "10/08/2015",
    end: "24/08/2015"
  },
  {
    type: "FF",
    name: "43.1",
    start: "24/08/2015",
    end: "07/09/2015"
  },
  {
    type: "FF",
    name: "43.2",
    start: "07/09/2015",
    end: "21/09/2015"
  },
  {
    type: "FF",
    name: "43.3",
    start: "21/09/2015",
    end: "05/10/2015"
  },
  {
    type: "FF",
    name: "44.1",
    start: "05/10/2015",
    end: "19/10/2015"
  },
  {
    type: "FF",
    name: "44.2",
    start: "19/10/2015",
    end: "02/11/2015"
  },
  {
    type: "FF",
    name: "44.3",
    start: "02/11/2015",
    end: "16/11/2015"
  },
  {
    type: "ADDON",
    name:  "1.0",
    start: "16/11/2015",
    end: "14/12/2015"
  },
  {
    type: "ADDON",
    name:  "1.1",
    start: "18/12/2015",
    end: "25/01/2016"
  },
  {
    type: "ADDON",
    name:  "1.2",
    start: "25/01/2016",
    end: "---",
    bug: "1248602"
  }
];


RELEASES.reduce((sequence, release) => {
  // console.log('...inside reduce');
  // console.log(release);
  return sequence.then(() => {
    // console.log('...inside sequence.then');
    return Bugziller.getRel(release);
  }).then(bugList => {
    // console.log('bugList = ' + JSON.stringify(bugList));
    return filterBugs(bugList);
  }).then(classifiedLists => {
    // console.log('filtered = ' + JSON.stringify(classifiedLists));
    return printData(release, classifiedLists);
  });
}, Promise.resolve())
.catch((error) => console.error('something went WRONG'))
.then(() => UI.loading.classList.add('nope'));

function filterBugs(list) {
  if (!list) {
    return Promise.resolve();
  }

  let total = list.length,
      metas = [],
      taken = [],
      fixed = [];

  list.forEach(bug => {
    if (Bugziller.isMeta(bug)) {
      metas.push(bug);
    } else {
      // counted for resolution
      taken.push(bug);

      if (Bugziller.isClosed(bug)) {
        fixed.push(bug);
      }
    }
  });
  return Promise.resolve({
    total: total,
    metas: metas,
    taken: taken,
    fixed: fixed
  });
}

function printData(origin, data) {
  if (!origin || !data) {
    return Promise.resolve();
  }
  // fill data
  let newRelease = document.createElement('li');
  let name = document.createElement('h2');
  name.textContent = 'v' + origin.name + ' | ' +
                     '(' + origin.start + ' - ' + origin.end + ')';
  newRelease.appendChild(name);

  let total = document.createElement('h3');
  total.textContent = data.total + ' bugs in total';
  newRelease.appendChild(total);

  let meta = document.createElement('h3');
  meta.textContent = 'including ' + data.metas.length + ' [Meta] bugs';
  newRelease.appendChild(meta);

  let commited = document.createElement('h3');
  commited.textContent = 'From ' + data.taken.length + ' commited';
  newRelease.appendChild(commited);

  let fixed = document.createElement('h3');
  fixed.textContent = data.fixed.length + ' were solved';
  newRelease.appendChild(fixed);

  UI.results.appendChild(newRelease);

  console.log('RELEASE - ' + origin.name);
  console.log('total - ' + data.total);
  console.log('[meta] - ' + data.metas.length);
  console.log('commited - ' + data.taken.length);
  console.log('solved - ' + data.fixed.length);
  console.log();
}

// ------------------------
// for (let rel in RELEASES) {
//   // show spinner

//   // query
//   Bugziller.getRel(RELEASES[rel])
//   // paint results
//   .then(fullList => {
//     if (!fullList) {
//       return;
//     }
//     var totalBugs = fullList.length;
//     fullList.forEach(bug => {
//       if (Bugziller.isMeta(bug)) {
//         metaBugs.push(bug);
//       } else {
//         // counted for resolution
//         commitedBugs.push(bug);

//         if (Bugziller.isClosed(bug)) {
//           closedBugs.push(bug);
//         }
//       }
//     });
//     // fill data
//     let newRelease = document.createElement('li');
//     let name = document.createElement('h2');
//     name.textContent = 'v' + rel + ' | ' +
//                        '(' + rel.start + ' - ' + rel.end + ')';
//     newRelease.appendChild(name);

//     let total = document.createElement('h3');
//     total.textContent = totalBugs + ' bugs in total';
//     newRelease.appendChild(total);

//     let meta = document.createElement('h3');
//     meta.textContent = 'including ' + metaBugs.length + ' [Meta] bugs';
//     newRelease.appendChild(meta);

//     let commited = document.createElement('h3');
//     commited.textContent = 'From ' + commitedBugs.length + ' commited';
//     newRelease.appendChild(commited);

//     let fixed = document.createElement('h3');
//     fixed.textContent = closedBugs.length + ' were solved';
//     newRelease.appendChild(fixed);

//     UI.results.appendChild(newRelease);

//     console.log('RELEASE - ' + rel);
//     console.log('total - ' + totalBugs);
//     console.log('[meta] - ' + metaBugs.length);
//     console.log('commited - ' + commitedBugs.length);
//     console.log('solved - ' + closedBugs.length);
//     console.log();

//     return Promise.resolve();
//   });
// }
//   // show it
//   UI.loading.classList.add('nope');
// ------------------------
// Bugziller.getAll(1248602).then(fullList => {
//   var total = fullList.length;
//   fullList.forEach(bug => {
//     if (Bugziller.isMeta(bug)) {
//       metaBugs.push(bug);
//     } else {
//       // counted for resolution
//       commitedBugs.push(bug);

//       if (Bugziller.isClosed(bug)) {
//         closedBugs.push(bug);
//       }
//     }
//   });
//   // fill data
//   UI.totalBugs.textContent = total;
//   UI.metaBugs.textContent = metaBugs.length;
//   UI.assignedBugs.textContent = commitedBugs.length;
//   UI.fixedBugs.textContent = closedBugs.length;

//   // show it
//   UI.results.classList.remove('nope');
//   UI.loading.classList.add('nope');

//   console.log('total - ' + total);
//   console.log('[meta] - ' + metaBugs.length);
//   console.log('commited - ' + commitedBugs.length);
//   console.log('solved - ' + closedBugs.length);
// });

// META   1248602
// NON-F  1248604
