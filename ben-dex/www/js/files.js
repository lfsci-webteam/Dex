var filesContext = {

	//Gets or creates a file at a given path, including any directories along the way.
	getFile: function (path, callback) {
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, haveFileSystem, filesContext.fileError);

		function haveFileSystem(fileSystem) {
			console.log("File System Loaded. Name: " + fileSystem.name);
			fileSystem.root.getFile(path, { create: true, exclusive: false }, haveFile, filesContext.fileError);
		}
		function haveFile(file) {
			console.log("File loaded. Full Path: " + file.fullPath);
			callback(file);
		}
	},

	fileError: function(error) {
		var message = "An unrecognized file error has occured";
		if (error.code == FileError.NOT_FOUND_ERR)
			message = "Not Found";
		else if(error.code == FileError.SECURITY_ERR)
			message = "Security Error";
		else if (error.code == FileError.ABORT_ERR)
			message = "Aborted";
		else if (error.code == FileError.NOT_READABLE_ERR)
			message = "Not Readable";
		else if (error.code == FileError.ENCODING_ERR)
			message = "Encoding Error";
		else if (error.code == FileError.NO_MODIFICATION_ALLOWED_ERR)
			message = "No Modification Allowed";
		else if (error.code == FileError.INVALID_STATE_ERR)
			message = "Invalid State";
		else if (error.code == FileError.SYNTAX_ERR)
			message = "Syntax Error";
		else if (error.code == FileError.INVALID_MODIFICATION_ERR)
			message = "Invalid Modification";
		else if (error.code == FileError.QUOTA_EXCEEDED_ERR)
			message = "Quota Exceeded";
		else if (error.code == FileError.TYPE_MISMATCH_ERR)
			message = "Type Mismatch";
		else if (error.code == FileError.PATH_EXISTS_ERR)
			message = "Path Exists";
		message = "File Error: " + message;
		console.log(message);
		alert(message);
	},
}