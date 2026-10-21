package com.acme.usermark.application.profile;

/**
 * The change of the editable base data of the profile. A null field stays
 * untouched, the use case decides what a change means.
 */
public record UpdateProfileCommand(String displayName, String email, String ifMatch) {}
