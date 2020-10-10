#!/usr/bin/env python3
"""
A helper script that adds jyutping to the standard Chinese dictionary.
Simply specify a CEDICT dictionary as input, and use a different file for output.
"""
import os
import jyutping
import argparse
import re

parser = argparse.ArgumentParser(description='Adds jyutping to all entries in the standard Chinese dictionary')
parser.add_argument('--input', dest='inputPath', help='Input dictionary file')
parser.add_argument('--output', dest='outputPath', help='Output dictionary file')
args = parser.parse_args()

with open(args.inputPath) as input:
    with open(args.outputPath, "w+") as output:
        lines = input.readlines()

        for line in lines:
            characters = line.split(" ")[0]
            pronunciation = jyutping.get(characters)
            if None in pronunciation:
                pronunciation = []

            for i in range(len(pronunciation)):
                if isinstance(pronunciation[i], list):
                    pronunciation[i] = "/".join(pronunciation[i])

            replPattern = r"\1 \2 [\3] {{{0}}} /\4/".format(" ".join(pronunciation))
            newLine = re.sub(r"(.+?) (.+?) \[(.+?)\] \/(.+)\/", replPattern, line)
            output.write(newLine)