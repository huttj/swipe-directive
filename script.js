angular.module('CardTest', [])

.factory('Hammer', function() {
  return {
    new: function(element, options) {
      return new Hammer(element, options);
    }
  }
})

.factory('ImgurGrabber', function($http) {
  var images = [];
  var requestResult = $http.get('images.json').then(function(result) {
    images = result.data.sort(function() {
      return Math.random() * 2 - 1;
    });
    return images;
  });

  var index = 0;
  var increment = 6;

  var queue = [];
  var preloadCounter = 1;

  function preloadImages(imageList) {
    console.log('Image ' + preloadCounter + ' loading: ' + imageList[0]);
    var img = document.createElement('img');
    queue.push(img);
    img.onload = (function(imageURl, counter) {
      img.loaded = true;
      console.log('Image ' + counter + ' finished: ' + imageURl);
      if (imageList.length > 1) preloadImages(imageList.slice(1));
    }).bind(null, imageList[0], preloadCounter);
    preloadCounter++;
    img.src = imageList[0];
  }

  function deloadImages() {
    queue.forEach(function(n) {
      if (n.loaded) {
        n.remove();
      }
    })
  }

  requestResult.then(function(i) {
    preloadImages(i.slice(0, increment).reverse());
  });

  return {
    images: requestResult,
    next: function() {
      index += increment;

      deloadImages();
      preloadList = images.slice(index, index+increment).reverse();
      preloadImages(preloadList);

      return images.slice(index - increment, index);
    }
  };
})

.controller('MainCtrl', function($scope, ImgurGrabber) {
  $scope.next = function() {
    $scope.$broadcast('load next');
  }
})

.directive('stack', function(ImgurGrabber) {
  return {
    restrict: 'EA',
    template: '<card ng-repeat="card in cards" image="card" offset="cards.length - $index"></card>',
    controller: function($scope) {
      ImgurGrabber.images.then(function() {
        $scope.cards = ImgurGrabber.next();
      })

      $scope.$on('load next', function() {
        $scope.cards = ImgurGrabber.next();
      });

      $scope.$on('delete card', function() {
        $scope.$apply(function() {
          if ($scope.cards.length > 1) {
            $scope.cards.pop();
          } else {
            $scope.cards = ImgurGrabber.next();
          }
        });
      })
    }
  }
})

.directive('card', function(Hammer) {
  return {
    restrict: 'E',
    scope: {
      card: '=image',
      offset: '=offset'
    },
    link: function(scope, element, attrs) {
      var DRAG_SENSITIVITY = 5;

      var image = new Image();

      image.onload = function() {
        scope.width = image.width;
        scope.height = image.height;

        if (scope.width > scope.height) {
          // Minus 2 for the border
          scope.ratio = (element[0].clientHeight - 2) / scope.height;
        } else {
          scope.ratio = (element[0].clientWidth - 2) / scope.width;
        }

        DRAG_SENSITIVITY *= scope.ratio;

        scope.hspace = Math.max((scope.width - scope.height) / 2, 0) * scope.ratio;
        scope.vspace = Math.max((scope.height - scope.width) / 2, 0) * scope.ratio;


      }
      image.src = scope.card;

      var startCoords = {
        x: 0,
        y: 0
      }

      var listeners = [];

      element.css('background-image', 'url(' + scope.card + ')');

      scope.$watch(function() {
        return scope.offset
      }, function(newVal, oldVal) {

        if (scope.offset == '1') {

          listeners.forEach(function(n) {
            n();
          })

          var touch = Hammer.new(element[0]);

          touch.on('panstart', function(e) {
            //startCoords = getCoords();
            element.css('transition', '');
          })

          touch.on('panend', function(e) {

            scope.$parent.$parent.$broadcast('panend', null);

            if (
              (e.velocityX * e.deltaX < 0 &&
                (
                  Math.abs(e.velocityX) > .5 ||
                  Math.abs(e.deltaX) > (window.innerWidth / 2)
                )) ||
              Math.abs(e.velocityX) > 1.75
            ) {
              element.css('transition', 'all 300ms ease');

              // var xSign = Math.abs(e.deltaX) / e.deltaX;
              var ySign = Math.abs(e.deltaY) / e.deltaY;

              var xVel = Math.abs(e.velocityX) / e.velocityX;

              translate3d({
                x: -xVel * window.innerWidth,
                y: -e.velocityY * window.innerHeight / 2
              }, null, true)

              setTimeout(function() {
                scope.$emit('delete card', null);
              }, 300)

            } else {
              element.css('background-position', 'center center');
              spring(null, null, null);
            }

            // scope.$parent.$parent.$broadcast('panend', coords);

          });

          touch.on('pan', function(e) {

            // Parallax panning of bg-image
            var vdrift = -scope.vspace;
            var hdrift = -scope.hspace;

            if (scope.hspace > 0) {
              if (e.deltaX < 0) {
                hdrift = Math.round(Math.max(e.deltaX * DRAG_SENSITIVITY * (scope.hspace / window.innerWidth), -scope.hspace) - scope.hspace);
              } else {
                hdrift = Math.round(Math.min(e.deltaX * DRAG_SENSITIVITY * (scope.hspace / window.innerWidth), scope.hspace) - scope.hspace);
              }
            }

            if (scope.vspace > 0) {
              if (e.deltaY < 0) {
                vdrift = Math.round(Math.max(e.deltaY * DRAG_SENSITIVITY * (scope.vspace / window.innerHeight), -scope.vspace) - scope.vspace);
              } else {
                vdrift = Math.round(Math.min(e.deltaY * DRAG_SENSITIVITY * (scope.vspace / window.innerHeight), scope.vspace) - scope.vspace);
              }
            }

            element.css('background-position', hdrift + 'px ' + vdrift + 'px');

            translate3d({
              x: e.deltaX,
              y: e.deltaY
            });
          });

        } else {

          var startCoords = getCoords();

          listeners.push(scope.$on('translate', function(event, data) {
            element.css('transition', '');
            translate3d({
              x: data[0].x / Math.pow(scope.offset, 1.5),
              y: data[0].y / Math.pow(scope.offset, 1.5)
            }, data[1], true);
          }))

          listeners.push(scope.$on('panend', function(event, data) {

            spring(null, null, true);

          }));
        }

      })

      function translate3d(coords, start, broadcast) {
        var start = isNull(start, startCoords);

        TweenLite.to(element[0], 0, {
          x: start.x + coords.x,
          y: start.y + coords.y,
          z: 0
        });

        if (!broadcast) scope.$parent.$parent.$broadcast('translate', [coords, start]);
      }

      function spring(coords, start, broadcast) {
        coords = coords || {x: 0, y: 0};
        coords.ease = Elastic.easeOut;
        coords.z = 0;
        TweenLite.to(element[0], .75, coords);
      }

      function getCoords() {
        var c = element.css('transform').match(/translate3d\((-?\d+)(?:px)?, ?(-?\d+)(?:px)?, ?(-?\d+)(?:px)?\)/);

        // startX = startingX && startingX.length > 1 ? Number(startingX[1]) : 0;
        var x = c && c[1] ? Number(c[1]) : 0;
        var y = c && c[2] ? Number(c[2]) : 0;

        return {
          x: x,
          y: y
        }
      }

      function getDist() {
        var coords = getCoords();
        return Math.sqrt(Math.pow(coords.x, 2) + Math.pow(coords.y, 2));
      }

      function isNull(a, b) {
        return a === null || a === undefined ? b : a;
      }

    }
  }
})