package com.acme.usermark.application.file;

/**
 * The change of a file object. A null field stays untouched, the use case
 * decides what a change means.
 */
public record UpdateFileCommand(String name, String description, String ifMatch) {}
