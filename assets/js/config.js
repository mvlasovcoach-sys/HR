(function(){
  window.SHOW_KPI_DETAILS = false;
  window.THRESHOLDS = window.THRESHOLDS || {
    wellbeing: { green: [70, 100], amber: [56, 69], red: [0, 55] },
    stressPct: { green: [0, 20], amber: [21, 35], red: [36, 100] },
    fatiguePct: { green: [0, 25], amber: [26, 40], red: [41, 100] }
  };
})();
