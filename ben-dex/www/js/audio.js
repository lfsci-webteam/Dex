var audioContext = {
	
	currentFilename: null,
	mediaController: null,

	startRecording: function (filename) {
		audioContext.currentFilename = filename;
		//TODO: Currently, this code is being designed to support iOS. Android works a bit differently, I think.

		filesContext.getFile(filename, haveFile); //Make sure file exists
		function haveFile(file) {
			audioContext.mediaController = new Media(filename, mediaSuccess, audioContext.audioError);
			audioContext.mediaController.startRecord();
		}
		function mediaSuccess() {
			console.log("Recording succeeded!");
		}
	},

	stopRecording: function () {
		if (!audioContext.mediaController) {
			alert("Error: audioContext.stopRecording called while audio was not being recorded");
			console.log("Error: audioContext.stopRecording called while audio was not being recorded");
			return;
		}
		audioContext.mediaController.stopRecord();
		audioContext.mediaController = null;
	},

	playRecording: function () {
		//alert("Tweet tweet!\n(" + audioContext.currentFilename + ")");
		var media = new Media(audioContext.currentFilename);
		media.setVolume(1.0);
		media.play();
	},

	getFileExtension: function () {
		return "wav";
	},

	audioError: function(error) {
		alert("Media Error!\nCode: " + error.code + "\nMessage: " + error.message);
	},
}