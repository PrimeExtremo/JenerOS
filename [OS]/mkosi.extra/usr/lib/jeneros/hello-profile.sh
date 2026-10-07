#!/bin/sh
# Sourced by /etc/profile. No output for SSH commands, scp, or rsync.
case $- in
    *i*) /usr/lib/jeneros/hello || : ;;
esac
