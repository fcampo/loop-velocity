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
  const QUERY_URL = "https://bugzilla.mozilla.org/rest/bug?"
  var fields = [
    "id",
    "summary",
    "resolution",
    "depends_on"
  ];
  var options = "include_fields=" + fields.join(',') +
                "&product=Hello%20%28Loop%29";

  // hashtable to avoid repetitions
  var checkedBugs = {};

  // checks if a specific bug is a [Meta]
  function isMeta(bug) {
    if (!bug || !bug.summary) {
      console.error('ooopsie no summary');
      return false;
    }
    let metaReg = new RegExp(/[\[|\(]meta[\]|\)]/);
    return metaReg.test(bug.summary);
  }

  //checks if a bug is closed, independently of the reason for it
  function isClosed(bug) {
    return !!bug.resolution;
  }

  // checks if a bug is fixed
  function isFixed(bug) {
    return bug.resolution === "FIXED";
  }
  /*
   * get basic info from bug(s)
   * bug details, immediate dependencies
   */
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

  /**
   * get all the existing dependencies of a specific bugs
   * includes CLOSED bugs
   */
  function getDependencies(bugList) {
    return bugList.reduce((p,c) => {
      return p.then(partial => {
        return getAll(c.depends_on).then(depList => {
          return partial.concat(depList);
        });
      });
    }, Promise.resolve([]));
  }

  /**
   * get everything related to a bug
   * details, dependencies, and subdependencies
   */
  function getAll(bugArray) {
    var list = [];
    // convert to Array just in case
    bugArray = [].concat(bugArray);
    if (!bugArray.length) {
      return Promise.resolve([]);
    }
    return getBug(bugArray).then(infoArray => {
      infoArray.forEach(bug => {
        // add only the id, as we'll filter later
        list.push(bug.id);
      });
      return getDependencies(infoArray).then(depends => {
        return list.concat(depends);
      });
    });
  }

  /**
   * get all data for a specific release based on the dates of it
   * commited:  all bugs that were assigned to someone during the release.
   *            They may or may not have been solved on time.
   * solved:    all bugs that were solved during the release.
   *            Could have been assigned on previous release though
   * complete:  100% on time. bugs that were assigned AND solved during the release
   * @param start   Date starting date for the release query
   * @param end     Date ending date for the release query
   * @param bugList [optional] limit the search to a series of bugs
   */
  function getAllFromDates(start, end, bugList) {
    let baseQuery = QUERY_URL + options +
                    (!!bugList ? "&id=" + bugList.join(',') : "");

    let dateIni = moment(start, "DD/MM/YYYY");
    dateIni = (dateIni.isValid() ? dateIni : moment()).format("YYYY-MM-DD");
    let dateEnd = moment(end, "DD/MM/YYYY");
    dateEnd = (dateEnd.isValid() ? dateEnd : moment()).format("YYYY-MM-DD");

    let qSolved = baseQuery +
                  "&f1=resolution" +
                  "&o1=changedafter" +
                  "&v1=" + dateIni +
                  "&f2=resolution" +
                  "&o2=changedbefore" +
                  "&v2=" + dateEnd +
                  "&f3=resolution" +
                  "&o3=changedto" +
                  "&v3=fixed";
    let qCommited = baseQuery +
                  "&f1=assigned_to" +
                  "&o1=changedafter" +
                  "&v1=" + dateIni +
                  "&f2=assigned_to" +
                  "&o2=changedbefore" +
                  "&v2=" + dateEnd +
                  "&f3=assigned_to" +
                  "&o3=changedfrom" +
                  "&v3=nobody%40mozilla.org";
    let qCompleted = baseQuery +
                  "&f1=assigned_to" +
                  "&o1=changedafter" +
                  "&v1=" + dateIni +
                  "&f2=assigned_to" +
                  "&o2=changedbefore" +
                  "&v2=" + dateEnd +
                  "&f3=assigned_to" +
                  "&o3=changedfrom" +
                  "&v3=nobody%40mozilla.org" +
                  "&f4=resolution" +
                  "&o4=changedafter" +
                  "&v4=" + dateIni +
                  "&f5=resolution" +
                  "&o5=changedbefore" +
                  "&v5=" + dateEnd +
                  "&f6=resolution" +
                  "&o6=changedto" +
                  "&v6=fixed";

    return Promise.all(
      [qSolved,
       qCommited,
       qCompleted].map(query => {
      return fetch(query)
        .then(response => response.json())
        .then(json => json.bugs);
      })
    ).then(resultArray => resultArray);
  }

  function getReleaseData(release) {
    if (!release) {
      console.error(' - no RELEASE to check -');
      return Promise.resolve();
    }
    console.log('> Checking release ' + release.name);
    // bug dependency
    if (release.bug) {
      console.log('-- from bug');
      return getAll(release.bug).then(list => {
        return getAllFromDates(release.start, release.end, list);
      });
    }
    console.log('-- from dates');
    // date dependency
    return getAllFromDates(release.start, release.end);
  }

  function getSprintVelocity() {
    // sprint size is 2 weeks, and we start counting on FF34
    var START = "05/08/2014";
    var dFormat = "YYYY-MM-DD";

    let sprintArray = [];
    let date = moment(START, "DD-MM-YYYY");
    // limit on today's last sunday
    while (date.isBefore(moment().weekday(0))) {
      sprintArray.push({
        start: date.weekday(1).format(dFormat),// monday same week
        end: date.weekday(15).format(dFormat)  // monday 2 weeks after
      });
    }
    var resultArray = [];
    var i=0;
    return sprintArray.map(sprint => {
      return querySolved(sprint.start, sprint.end)
             .then(solvedArray => {
              resultArray.push(solvedArray.length);
              return solvedArray.length
            });
    }).reduce((sequence, result) => {
      return sequence.then(function() {
        return result;
      }).then(result => {
        barChart.addData([result], sprintArray[i++].end);
      });
    }, Promise.resolve())
    .then(() => resultArray);
  }

  function querySolved(start, end) {
    let query = QUERY_URL + options +
                "&f1=resolution" +
                "&o1=changedafter" +
                "&v1=" + start +
                "&f2=resolution" +
                "&o2=changedbefore" +
                "&v2=" + end +
                "&f3=resolution" +
                "&o3=changedto" +
                "&v3=fixed";

    return fetch(query)
            .then(response => response.json())
            .then(json => json.bugs);
  }

  return {
    getRelease: getReleaseData,
    getAll: getAll,
    getOne: getBug,
    isMeta: isMeta,
    isClosed: isClosed,
    getVelocity: getSprintVelocity
  };

})(window);

var UI = {
  results: document.getElementById('results'),
  loading: document.getElementById('loading'),
  velocity: document.querySelector('.velocity'),
  deviation: document.querySelector('.deviation')
};


// Get the context of the canvas element we want to select
var dataBar = {
  labels: [],
  datasets: [{
    fillColor: "rgba(50,150,200,0.7)",
    data: []
  }]
};
var ctx = document.getElementById("graph").getContext("2d");
var barChart = new Chart(ctx).Bar(dataBar, {
  maintainAspectRatio: true,
  responsive: true,
  barValueSpacing: 0.5,
  animationSteps: 15
});


Bugziller.getVelocity()
.then(resultArray => updateVelocity(resultArray))
.catch((error) => console.error('OH NO! => ' + error))
.then(() => { // update UI to show results and hide loading icon
  UI.results.classList.remove('nope');
  UI.loading.classList.add('nope');
});

function updateVelocity(dataArray) {
  // For the velocity we can show the average of the values
  let avg = average(dataArray);
  // But we'll also need to calculate the standard deviation
  let stdDev = stdDeviation(dataArray);

  // Now we can show the values
  UI.velocity.textContent = parseFloat(avg).toFixed(0);
  UI.deviation.textContent = "± " + parseFloat(stdDev).toFixed(0);
}

// just calculate the average of the values passed as an array
function average(data) {
  var sum = data.reduce((sum, value) => sum + value, 0);
  return sum / data.length;;
}

// The Standard Deviation is calculated...
//  "by taking the square root of the average of the squared differences
//   of the values from their average value"
function stdDeviation(pureData) {
  // first calculate the average of the pure data
  var avg = average(pureData);
  // now the squared diffs
  var squareDiffs = pureData.map(value => (value - avg) * (value - avg));
  // then the squared average
  var avgSquareDiff = average(squareDiffs);
  // and finally calculate the deviation
  return Math.sqrt(avgSquareDiff);
}

/**
 * Cleans the bug lists from not desired values.
 * In this case, [Meta] bugs
 * @param filteredRelease 3-pos-array with bug array inside.
 *        [0] - all assigned bugs for the release.
 *        [1] - all solved bugs during the release.
 *        [2] - bugs both assigned and solved during release.
 */
function filterBugs(filteredRelease) {
  if (!filteredRelease || filteredRelease.length != 3) {
    console.error('Wrongly filtered list: ' + filteredRelease);
    return Promise.resolve();
  }

  let total = filteredRelease.length,
      metas = [],
      taken = [],
      fixed = [];

  // [[assigned], [solved], [fullyDone]]
  return Promise.resolve(filteredRelease.map(bugList => {
    let metas = [];
    let done = [];

    bugList.forEach((bug, pos) => {
      console.log('checking bug ' + JSON.stringify(bug) + '-' + pos);
      if (Bugziller.isMeta(bug)) {
        metas.push(bug);
        bugList.splice(pos, 1);
      // } else {
      //   // counted for resolution
      //   done.push(bug);
      }
    });

    return {
      metas: metas,
      done: bugList
    };
  }));

  // return Promise.resolve(filteredRelease);
  // {
  //   total: total,
  //   metas: metas,
  //   taken: taken,
  //   fixed: fixed
  // });
}

// data = [
//  [assigned = { metas, done }],
//  [solved = { metas, done }],
//  [fullyDone = { metas, done }]
// ]
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

  let assigned = document.createElement('h3');
  assigned.textContent = data[0].done.length + ' assigned' +
                         ' (+ ' + data[0].metas.length + ' metas)';
  newRelease.appendChild(assigned);

  let solved = document.createElement('h3');
  solved.textContent = data[1].done.length + ' solved' +
                       ' (+ ' + data[1].metas.length + ' metas)';
  newRelease.appendChild(solved);

  let fullyDone = document.createElement('h3');
  fullyDone.textContent = data[2].done.length + ' both assigned and solved' +
                          ' (+ ' + data[2].metas.length + ' metas)';
  newRelease.appendChild(fullyDone);

  UI.results.appendChild(newRelease);
}

// TODO: cambiar releases por 2-week plannings
  //  necesitamos saber el bug-per-sprint velocity
  //  después de eso, dividir en releases si necesario.
  // FF34  Development 05/08/2014 — 16/09/2014
  // FF35  Development 16/09/2014 — 28/10/2014
  // FF36  Development 28/10/2014 — 22/12/2014
  // FF37  Development 22/12/2014 — 26/01/2015
  // FF38  Development 26/01/2015 — 09/03/2015
  // FF39  Development 09/03/2015 — 13/04/2015
  // FF40  Development 13/04/2015 — 25/05/2015
  // FF41  Development 25/05/2015 — 13/07/2015
  // FF42  Development 13/07/2015 — 24/08/2015
  // FF43  Development 24/08/2015 — 05/10/2015
  // FF44  Development 05/10/2015 — 16/11/2015
  // v1.0  Development 12/10/2015 — 08/12/2015
  // v1.1  Development 04/01/2016 — 01/03/2016
  // v1.2  Development 15/02/2016 — 22/03/2016
  // v1.3  Development 21/03/2016 — 01/04/2016
  // vCOD  Development 23/03/2016 — 02/05/2016

// RELEASE BASED CALCULATIONS
  // const RELEASES = [
  //   {
  //     type: "FF",
  //     name: "34",
  //     start: "05/08/2014",
  //     end: "16/09/2014"
  //   },
  //   {
  //     type: "FF",
  //     name: "35",
  //     start: "16/09/2014",
  //     end: "28/10/2014"
  //   },
  //   {
  //     type: "FF",
  //     name: "36",
  //     start: "28/10/2014",
  //     end: "22/12/2014"
  //   },
  //   {
  //     type: "FF",
  //     name: "37",
  //     start: "22/12/2014",
  //     end: "26/01/2015"
  //   },
  //   {
  //     type: "FF",
  //     name: "38",
  //     start: "26/01/2015",
  //     end: "09/03/2015"
  //   },
  //   {
  //     type: "FF",
  //     name: "39",
  //     start: "09/03/2015",
  //     end: "13/04/2015"
  //   },
  //   {
  //     type: "FF",
  //     name: "40",
  //     start: "13/04/2015",
  //     end: "25/05/2015"
  //   },
  //   {
  //     type: "FF",
  //     name: "41",
  //     start: "25/05/2015",
  //     end: "13/07/2015"
  //   },
  //   {
  //     type: "FF",
  //     name: "42",
  //     start: "13/07/2015",
  //     end: "24/08/2015"
  //   },
  //   {
  //     type: "FF",
  //     name: "43",
  //     start: "24/08/2015",
  //     end: "05/10/2015"
  //   },
  //   {
  //     type: "FF",
  //     name: "44",
  //     start: "05/10/2015",
  //     end: "16/11/2015"
  //   },
  //   {
  //     type: "ADDON",
  //     name:  "1.0",
  //     start: "16/11/2015",
  //     end: "14/12/2015"
  //   },
  //   {
  //     type: "ADDON",
  //     name:  "1.1",
  //     start: "18/12/2015",
  //     end: "25/01/2016"
  //   },
  //   {
  //     type: "ADDON",
  //     name:  "1.2",
  //     start: "25/01/2016",
  //     end: "---",
  //     bug: "1248602"
  //   }
  // ];

  // RELEASES.reduce((sequence, release) => {
  //   // console.log('...inside reduce');
  //   // console.log(release);
  //   return sequence.then(() => {
  //     // console.log('...inside sequence.then');
  //     return Bugziller.getRelease(release);
  //   }).then(fullBugList => {
  //     // console.log('bugList = ' + JSON.stringify(bugList));
  //     return filterBugs(fullBugList);
  //   }).then(classifiedLists => {
  //     console.log('filtered = ' + JSON.stringify(classifiedLists));
  //     return printData(release, classifiedLists);
  //   });
  // }, Promise.resolve())
  // .catch((error) => console.error('something went WRONG ' + error))
  // .then(() => UI.loading.classList.add('nope'));

